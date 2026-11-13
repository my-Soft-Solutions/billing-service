'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const transaction = { LOCK: { UPDATE: 'UPDATE' } };
const models = {
    Payment: {
        findOne: async options => {
            state.paymentLookup = options;
            return state.payment;
        },
        create: async (values, options) => {
            state.createdPayment = values;
            state.createOptions = options;
            return makePayment(values);
        },
        findAndCountAll: async options => {
            state.listOptions = options;
            return state.listResult;
        },
        findAll: async options => {
            state.recordedPaymentOptions = options;
            return state.recordedPayments;
        }
    },
    sequelize: {
        transaction: callback => callback(transaction)
    }
};
const invoiceService = {
    requireById: async (...args) => {
        state.invoiceLookupArgs = args;
        return state.invoice;
    }
};
const auditService = {
    record: async entry => {
        state.auditEntries.push(entry);
    }
};
const PaymentService = loadWithMocks(
    require.resolve('../services/PaymentService'),
    {
        '../models': models,
        './InvoiceService': invoiceService,
        './InvoiceAuditService': auditService
    }
);

function makeInvoice(overrides = {}) {
    return {
        id: 'invoice-1',
        status: 'issued',
        total_amount: '100.00',
        paid_amount: '0.00',
        balance_due: '100.00',
        due_date: '2099-01-01',
        async update(changes) {
            Object.assign(this, changes);
        },
        ...overrides
    };
}

function makePayment(values = {}) {
    return {
        id: 'payment-1',
        status: 'recorded',
        invoice_id: 'invoice-1',
        amount: '30.00',
        get() {
            return { ...this };
        },
        async update(changes) {
            Object.assign(this, changes);
        },
        ...values
    };
}

function paymentInput(overrides = {}) {
    return {
        invoice_id: 'invoice-1',
        payment_date: '2026-01-15',
        amount: '30.00',
        payment_method: 'bank_transfer',
        ...overrides
    };
}

beforeEach(() => {
    state.invoice = makeInvoice();
    state.payment = makePayment();
    state.paymentLookup = null;
    state.createdPayment = null;
    state.createOptions = null;
    state.listOptions = null;
    state.listResult = { rows: [], count: 0 };
    state.recordedPaymentOptions = null;
    state.recordedPayments = [{ amount: '10.00' }];
    state.invoiceLookupArgs = null;
    state.auditEntries = [];
});

describe('PaymentService', () => {
    it('finds a payment within its law firm', async () => {
        assert.equal(await PaymentService.findById('payment-1', 'firm-1'), state.payment);
        assert.deepEqual(state.paymentLookup, {
            where: { id: 'payment-1', law_firm_id: 'firm-1' }
        });
    });

    it('records a partial payment and updates invoice balance and status', async () => {
        const payment = await PaymentService.create(
            'firm-1',
            'user-1',
            paymentInput({ payment_reference: 'REF-1', notes: 'Received' })
        );

        assert.equal(payment.status, 'recorded');
        assert.equal(state.createdPayment.law_firm_id, 'firm-1');
        assert.equal(state.createdPayment.payment_reference, 'REF-1');
        assert.equal(state.createdPayment.amount, '30.00');
        assert.equal(state.invoice.paid_amount, '30.00');
        assert.equal(state.invoice.balance_due, '70.00');
        assert.equal(state.invoice.status, 'partially_paid');
        assert.equal(state.auditEntries[0].action, 'payment_recorded');
        assert.equal(state.invoiceLookupArgs[3].lock, transaction.LOCK.UPDATE);
    });

    it('marks the invoice paid for a full-balance payment', async () => {
        await PaymentService.create('firm-1', 'user-1', paymentInput({ amount: '100.00' }));

        assert.equal(state.invoice.paid_amount, '100.00');
        assert.equal(state.invoice.balance_due, '0.00');
        assert.equal(state.invoice.status, 'paid');
    });

    it('rejects payments on unsupported invoice states and amounts above the balance', async () => {
        state.invoice.status = 'draft';
        await assert.rejects(
            PaymentService.create('firm-1', 'user-1', paymentInput()),
            error => error.statusCode === 409
        );

        state.invoice.status = 'issued';
        await assert.rejects(
            PaymentService.create('firm-1', 'user-1', paymentInput({ amount: '100.01' })),
            error => error.statusCode === 400
        );
    });

    it('lists payments with optional invoice and status filters', async () => {
        state.listResult = { rows: [state.payment], count: 1 };
        const result = await PaymentService.list('firm-1', {
            page: '2',
            limit: '5',
            invoice_id: 'invoice-1',
            status: 'recorded'
        });

        assert.deepEqual(result.pagination, {
            page: 2,
            limit: 5,
            total: 1,
            totalPages: 1
        });
        assert.deepEqual(state.listOptions.where, {
            law_firm_id: 'firm-1',
            invoice_id: 'invoice-1',
            status: 'recorded'
        });
        assert.equal(state.listOptions.offset, 5);
        await assert.rejects(
            PaymentService.list('firm-1', { status: 'invalid' }),
            error => error.statusCode === 400
        );
    });

    it('voids a recorded payment and recalculates the invoice from remaining payments', async () => {
        state.invoice.paid_amount = '30.00';
        state.invoice.balance_due = '70.00';

        const payment = await PaymentService.void('payment-1', 'firm-1', 'user-1');

        assert.equal(payment.status, 'voided');
        assert.equal(state.invoice.paid_amount, '10.00');
        assert.equal(state.invoice.balance_due, '90.00');
        assert.equal(state.invoice.status, 'partially_paid');
        assert.equal(state.auditEntries[0].action, 'payment_voided');
        assert.equal(state.recordedPaymentOptions.where.status, 'recorded');
    });

    it('rejects missing payments and payments that are already voided', async () => {
        state.payment = null;
        await assert.rejects(
            PaymentService.void('missing', 'firm-1', 'user-1'),
            error => error.statusCode === 404
        );

        state.payment = makePayment({ status: 'voided' });
        await assert.rejects(
            PaymentService.void('payment-1', 'firm-1', 'user-1'),
            error => error.statusCode === 409
        );
    });

    it('preserves a cancelled invoice status when voiding a payment', async () => {
        state.invoice.status = 'cancelled';
        state.invoice.paid_amount = '30.00';
        state.payment = makePayment({ invoice_id: 'invoice-1' });

        await PaymentService.void('payment-1', 'firm-1', 'user-1');

        assert.equal(state.invoice.status, 'cancelled');
    });
});
