'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { beforeEach, describe, it } = require('node:test');

const transaction = { LOCK: { UPDATE: 'UPDATE' } };
const state = {};

const models = {
    Invoice: {
        findOne: async options => {
            state.invoiceLookupOptions = options;
            return state.invoice;
        },
        findAndCountAll: async options => {
            state.invoiceListOptions = options;
            return state.invoiceListResult;
        },
        create: async (data, options) => {
            state.createdInvoice = data;
            state.createOptions = options;
        }
    },
    InvoiceItem: {},
    InvoiceSetting: {
        findOne: async () => state.settings
    },
    sequelize: {
        transaction: callback => callback(transaction)
    }
};

const emailApiClient = {
    setAuthorizationHeader(value) {
        state.authorization = value || null;
    },
    post: async (...args) => {
        state.emailRequest = args;
        state.authorizationAtPost = state.authorization;
        if (state.emailError) throw state.emailError;
    }
};

const invoiceItemService = {
    prepareItems: items => items,
    createForInvoice: async (...args) => {
        state.createdItems = args;
        return [];
    },
    replaceForInvoice: async (...args) => {
        state.replacedItems = args;
    }
};

const invoiceNumberService = {
    generate: async (...args) => {
        state.invoiceNumberArgs = args;
        return 'BILL-2026-0001';
    },
    assertUnique: async (...args) => {
        state.assertUniqueArgs = args;
    }
};

const invoicePdfService = {
    generate: invoice => {
        state.pdfInvoice = invoice;
        return Buffer.from('invoice pdf');
    }
};

const invoiceAuditService = {
    record: async entry => {
        state.auditEntries.push(entry);
    }
};

const dependencies = new Map([
    ['../models', models],
    ['../config/axios', emailApiClient],
    ['./InvoiceItemService', invoiceItemService],
    ['./InvoiceNumberService', invoiceNumberService],
    ['./InvoicePdfService', invoicePdfService],
    ['./InvoiceAuditService', invoiceAuditService]
]);

const servicePath = path.resolve(__dirname, '../services/InvoiceService.js');
const originalLoad = Module._load;
Module._load = function loadWithServiceMocks(request, parent, isMain) {
    if (parent && parent.filename === servicePath && dependencies.has(request)) {
        return dependencies.get(request);
    }
    return originalLoad.call(this, request, parent, isMain);
};
const InvoiceService = require(servicePath);
Module._load = originalLoad;

function makeInvoice(overrides = {}) {
    const invoice = {
        id: 'invoice-1',
        status: 'draft',
        items: [],
        issue_date: null,
        due_date: null,
        discount_amount: '0.00',
        tax_amount: '0.00',
        total_amount: '0.00',
        paid_amount: '0.00',
        balance_due: '0.00',
        email_sent: false,
        email_sent_at: null,
        client_email: 'client@example.com',
        invoice_number: 'BILL-2026-0001',
        currency: 'USD',
        get() {
            return { ...this };
        },
        async update(changes) {
            Object.assign(this, changes);
            return this;
        },
        ...overrides
    };
    return invoice;
}

beforeEach(() => {
    Object.assign(state, {
        invoice: makeInvoice(),
        invoiceLookupOptions: null,
        settings: null,
        invoiceListOptions: null,
        invoiceListResult: { rows: [], count: 0 },
        createdInvoice: null,
        createOptions: null,
        createdItems: null,
        replacedItems: null,
        invoiceNumberArgs: null,
        assertUniqueArgs: null,
        auditEntries: [],
        authorization: null,
        authorizationAtPost: null,
        emailRequest: null,
        emailError: null,
        pdfInvoice: null
    });
});

describe('InvoiceService', () => {
    it('finds an invoice within its law firm and includes its items', async () => {
        const result = await InvoiceService.findById('invoice-1', 'firm-1', transaction, {
            lock: transaction.LOCK.UPDATE
        });

        assert.equal(result, state.invoice);
        assert.deepEqual(state.invoiceLookupOptions.where, {
            id: 'invoice-1',
            law_firm_id: 'firm-1'
        });
        assert.deepEqual(state.invoiceLookupOptions.include, [{
            model: models.InvoiceItem,
            as: 'items'
        }]);
        assert.equal(state.invoiceLookupOptions.lock, transaction.LOCK.UPDATE);
    });

    it('returns a 404 when a required invoice does not exist', async () => {
        state.invoice = null;

        await assert.rejects(
            InvoiceService.requireById('missing', 'firm-1'),
            error => error.statusCode === 404 && error.message === 'Invoice not found'
        );
    });

    it('creates an invoice using law-firm defaults and records the audit event', async () => {
        state.settings = {
            default_currency: 'USD',
            default_due_days: 30,
            default_tax_rate: '8',
            invoice_prefix: 'BILL',
            payment_instructions: 'Pay by bank transfer',
            invoice_footer: 'Thank you',
            default_notes: 'Default note'
        };
        const client = {
            name: 'Client',
            email: 'client@example.com',
            phone: '555-0100'
        };

        const result = await InvoiceService.create(
            'firm-1',
            'user-1',
            { client_id: 'client-1', issue_date: '2026-01-10', items: [] },
            client
        );

        assert.equal(result, state.invoice);
        assert.equal(state.createdInvoice.law_firm_id, 'firm-1');
        assert.equal(state.createdInvoice.client_name, 'Client');
        assert.equal(state.createdInvoice.currency, 'USD');
        assert.equal(state.createdInvoice.due_date, '2026-02-09');
        assert.equal(state.createdInvoice.invoice_number, 'BILL-2026-0001');
        assert.equal(state.createdInvoice.tax_rate, '8');
        assert.equal(state.createdInvoice.status, 'draft');
        assert.equal(state.createdInvoice.notes, 'Default note');
        assert.equal(state.auditEntries[0].action, 'invoice_created');
    });

    it('calculates the default due date and rejects invalid day offsets', () => {
        assert.equal(InvoiceService.defaultDueDate('2026-01-10', 30), '2026-02-09');
        assert.throws(
            () => InvoiceService.defaultDueDate('2026-01-10', 'invalid'),
            error => error.statusCode === 400
        );
    });

    it('lists invoices with pagination and an optional valid status filter', async () => {
        state.invoiceListResult = { rows: [state.invoice], count: 1 };

        const result = await InvoiceService.list('firm-1', {
            page: '2',
            limit: '5',
            status: 'issued'
        });

        assert.deepEqual(result, {
            data: [state.invoice],
            pagination: { page: 2, limit: 5, total: 1, totalPages: 1 }
        });
        assert.deepEqual(state.invoiceListOptions.where, {
            law_firm_id: 'firm-1',
            status: 'issued'
        });
        assert.equal(state.invoiceListOptions.offset, 5);
    });

    it('rejects invalid invoice status filters', async () => {
        await assert.rejects(
            InvoiceService.list('firm-1', { status: 'unknown' }),
            error => error.statusCode === 400 && error.message === 'Invalid invoice status'
        );
    });

    it('updates draft invoice details and records the audit event', async () => {
        state.invoice.notes = 'Old note';
        const result = await InvoiceService.update(
            'invoice-1',
            'firm-1',
            'user-1',
            { notes: 'Updated note' }
        );

        assert.equal(result.notes, 'Updated note');
        assert.equal(state.auditEntries[0].action, 'invoice_updated');
        assert.equal(state.auditEntries[0].oldValues.notes, 'Old note');
    });

    it('replaces invoice items when item data is provided', async () => {
        const items = [{
            id: 'item-1',
            description: 'Consultation',
            billing_type: 'fixed',
            quantity: '1.00',
            unit_price: '25.00',
            amount: '25.00',
            amountCents: 2500
        }];

        await InvoiceService.update('invoice-1', 'firm-1', 'user-1', { items });

        assert.equal(state.replacedItems[0], 'invoice-1');
        assert.deepEqual(state.replacedItems[1], items);
    });

    it('does not update an invoice that is no longer a draft', async () => {
        state.invoice.status = 'issued';

        await assert.rejects(
            InvoiceService.update('invoice-1', 'firm-1', 'user-1', { notes: 'Changed' }),
            error => error.statusCode === 409
        );
    });

    it('issues a draft invoice with items and records the status change', async () => {
        state.invoice.items = [{ id: 'item-1' }];

        const result = await InvoiceService.issue('invoice-1', 'firm-1', 'user-1');

        assert.equal(result.status, 'issued');
        assert.match(result.issue_date, /^\d{4}-\d{2}-\d{2}$/);
        assert.equal(state.auditEntries[0].action, 'invoice_issued');
    });

    it('does not issue a draft invoice without items', async () => {
        await assert.rejects(
            InvoiceService.issue('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 400 && /at least one item/.test(error.message)
        );
    });

    it('emails active invoices, clears the instance header, and returns the updated invoice', async () => {
        state.invoice.status = 'issued';

        const result = await InvoiceService.sendEmail(
            'invoice-1',
            'firm-1',
            'user-1',
            'Bearer test-token'
        );

        assert.equal(state.authorizationAtPost, 'Bearer test-token');
        assert.equal(state.authorization, null);
        assert.equal(state.emailRequest[1].to, 'client@example.com');
        assert.equal(state.emailRequest[1].attachments[0].content, Buffer.from('invoice pdf').toString('base64'));
        assert.equal(result, state.invoice);
        assert.equal(result.email_sent, true);
        assert.equal(state.auditEntries[0].action, 'invoice_email_sent');
    });

    it('rejects email delivery for draft or previously emailed invoices', async () => {
        await assert.rejects(
            InvoiceService.sendEmail('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );

        state.invoice.status = 'cancelled';
        await assert.rejects(
            InvoiceService.sendEmail('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );

        state.invoice.status = 'issued';
        state.invoice.email_sent = true;
        await assert.rejects(
            InvoiceService.sendEmail('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );
    });

    it('maps email API failures to a 502 and still clears the instance header', async () => {
        state.invoice.status = 'issued';
        state.emailError = new Error('network failure');
        const originalError = console.error;
        console.error = () => {};

        try {
            await assert.rejects(
                InvoiceService.sendEmail('invoice-1', 'firm-1', 'user-1', 'Bearer token'),
                error => error.statusCode === 502
            );
            assert.equal(state.authorization, null);
        } finally {
            console.error = originalError;
        }
    });

    it('cancels eligible invoices and rejects paid or already-cancelled invoices', async () => {
        const result = await InvoiceService.cancel('invoice-1', 'firm-1', 'user-1');

        assert.equal(result.status, 'cancelled');
        assert.equal(state.auditEntries[0].action, 'invoice_cancelled');

        state.invoice.status = 'paid';
        await assert.rejects(
            InvoiceService.cancel('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );

        state.invoice.status = 'cancelled';
        await assert.rejects(
            InvoiceService.cancel('invoice-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );
    });

    it('generates a PDF for the requested invoice', async () => {
        const result = await InvoiceService.pdf('invoice-1', 'firm-1');

        assert.equal(result.invoice, state.invoice);
        assert.deepEqual(result.document, Buffer.from('invoice pdf'));
        assert.equal(state.pdfInvoice, state.invoice);
    });
});
