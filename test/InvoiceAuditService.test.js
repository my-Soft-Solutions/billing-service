'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const models = {
    Invoice: {
        findOne: async options => {
            state.invoiceLookup = options;
            return state.invoice;
        }
    },
    InvoiceAuditLog: {
        create: async (values, options) => {
            state.createdLog = { values, options };
            return values;
        },
        findAndCountAll: async options => {
            state.listOptions = options;
            return state.listResult;
        }
    }
};
const InvoiceAuditService = loadWithMocks(
    require.resolve('../services/InvoiceAuditService'),
    { '../models': models }
);

beforeEach(() => {
    state.invoice = { id: 'invoice-1' };
    state.invoiceLookup = null;
    state.createdLog = null;
    state.listOptions = null;
    state.listResult = { rows: [], count: 0 };
});

describe('InvoiceAuditService', () => {
    it('records an audit event with nullable values and transaction options', async () => {
        const result = await InvoiceAuditService.record({
            invoiceId: 'invoice-1',
            firmId: 'firm-1',
            userId: 'user-1',
            action: 'invoice_updated',
            transaction: 'tx'
        });

        assert.equal(result.invoice_id, 'invoice-1');
        assert.equal(result.law_firm_id, 'firm-1');
        assert.equal(result.user_id, 'user-1');
        assert.equal(result.action, 'invoice_updated');
        assert.equal(result.old_values, null);
        assert.equal(result.new_values, null);
        assert.equal(state.createdLog.options.transaction, 'tx');
        assert.ok(state.createdLog.values.createdAt instanceof Date);
    });

    it('lists audit events with pagination scoped to the invoice and firm', async () => {
        state.listResult = { rows: [{ id: 'audit-1' }], count: 1 };

        const result = await InvoiceAuditService.list('invoice-1', 'firm-1', {
            page: '2',
            limit: '5'
        });

        assert.deepEqual(result, {
            data: [{ id: 'audit-1' }],
            pagination: { page: 2, limit: 5, total: 1, totalPages: 1 }
        });
        assert.deepEqual(state.invoiceLookup.where, {
            id: 'invoice-1',
            law_firm_id: 'firm-1'
        });
        assert.deepEqual(state.listOptions.where, {
            invoice_id: 'invoice-1',
            law_firm_id: 'firm-1'
        });
        assert.equal(state.listOptions.offset, 5);
    });

    it('returns not found when the invoice does not belong to the firm', async () => {
        state.invoice = null;

        await assert.rejects(
            InvoiceAuditService.list('invoice-1', 'other-firm'),
            error => error.statusCode === 404
        );
    });
});
