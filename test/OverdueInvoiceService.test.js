'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const models = {
    Invoice: {
        findAll: async options => {
            state.findOptions = options;
            return state.invoices;
        }
    },
    sequelize: {
        transaction: callback => callback(state.transaction)
    }
};
const auditService = {
    record: async entry => {
        state.auditEntries.push(entry);
    }
};
const OverdueInvoiceService = loadWithMocks(
    require.resolve('../services/OverdueInvoiceService'),
    { '../models': models, './InvoiceAuditService': auditService }
);

beforeEach(() => {
    state.transaction = { LOCK: { UPDATE: 'UPDATE' } };
    state.findOptions = null;
    state.auditEntries = [];
    state.invoices = [];
});

describe('OverdueInvoiceService', () => {
    it('marks matching invoices overdue and writes an audit event for each', async () => {
        const makeInvoice = (id, status) => ({
            id,
            law_firm_id: 'firm-1',
            status,
            async update(changes) {
                Object.assign(this, changes);
            }
        });
        state.invoices = [
            makeInvoice('invoice-1', 'issued'),
            makeInvoice('invoice-2', 'partially_paid')
        ];

        assert.equal(await OverdueInvoiceService.markOverdue('2026-01-15'), 2);
        assert.equal(state.invoices[0].status, 'overdue');
        assert.equal(state.invoices[1].status, 'overdue');
        assert.equal(state.auditEntries.length, 2);
        assert.equal(state.auditEntries[0].action, 'invoice_marked_overdue');
        assert.equal(state.auditEntries[0].userId, null);
        assert.deepEqual(state.findOptions.attributes, ['id', 'law_firm_id', 'status']);
        assert.equal(state.findOptions.lock, state.transaction.LOCK.UPDATE);
    });

    it('returns zero and emits no audits when no invoices match', async () => {
        assert.equal(await OverdueInvoiceService.markOverdue('2026-01-15'), 0);
        assert.deepEqual(state.auditEntries, []);
    });
});
