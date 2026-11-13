'use strict';

const assert = require('node:assert/strict');
const Sequelize = require('sequelize');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const models = {
    Invoice: {
        findAll: async options => {
            state.invoiceQueries.push(options);
            return [];
        },
        findAndCountAll: async options => {
            state.invoicePageOptions = options;
            return state.pageResult;
        }
    },
    Payment: {
        findAll: async options => {
            state.paymentQueries.push(options);
            return [];
        }
    },
    Sequelize
};
const ReportService = loadWithMocks(
    require.resolve('../services/ReportService'),
    { '../models': models }
);

beforeEach(() => {
    state.invoiceQueries = [];
    state.paymentQueries = [];
    state.invoicePageOptions = null;
    state.pageResult = { rows: [{ id: 'invoice-1' }], count: 1 };
});

describe('ReportService', () => {
    it('aggregates invoice totals, outstanding balances, client and case billing, and tax', async () => {
        await ReportService.getTotalInvoiced('firm-1');
        await ReportService.getTotalOutstanding('firm-1');
        await ReportService.getClientBilling('firm-1');
        await ReportService.getCaseBilling('firm-1');
        await ReportService.getTaxSummary('firm-1');

        assert.equal(state.invoiceQueries.length, 5);
        for (const query of state.invoiceQueries) {
            assert.equal(query.where.law_firm_id, 'firm-1');
            assert.ok(Array.isArray(query.where.status[Sequelize.Op.in]));
        }
        assert.deepEqual(state.invoiceQueries[0].group, ['currency']);
        assert.deepEqual(state.invoiceQueries[1].where.balance_due, {
            [Sequelize.Op.gt]: 0
        });
        assert.deepEqual(state.invoiceQueries[2].group, [
            'client_id',
            'client_name',
            'currency'
        ]);
        assert.deepEqual(state.invoiceQueries[3].where.case_id, {
            [Sequelize.Op.ne]: null
        });
        assert.deepEqual(state.invoiceQueries[4].group, ['currency']);
    });

    it('reports recorded payments by currency and month with firm-scoped invoice joins', async () => {
        await ReportService.getTotalPayments('firm-1');
        await ReportService.getMonthlyRevenue('firm-1');

        assert.equal(state.paymentQueries.length, 2);
        for (const query of state.paymentQueries) {
            assert.equal(query.where.law_firm_id, 'firm-1');
            assert.equal(query.where.status, 'recorded');
            assert.equal(query.include[0].as, 'invoice');
            assert.equal(query.include[0].required, true);
            assert.deepEqual(query.include[0].where, { law_firm_id: 'firm-1' });
        }
        assert.deepEqual(state.paymentQueries[0].group, [
            Sequelize.col('invoice.currency')
        ]);
        assert.equal(state.paymentQueries[1].group.length, 2);
    });

    it('returns paginated unpaid and overdue invoices with the correct filters', async () => {
        const unpaid = await ReportService.getUnpaidInvoices('firm-1', {
            page: '2',
            limit: '5'
        });
        assert.deepEqual(unpaid.pagination, {
            page: 2,
            limit: 5,
            total: 1,
            totalPages: 1
        });
        assert.deepEqual(state.invoicePageOptions.where.status, {
            [Sequelize.Op.in]: ['issued', 'partially_paid']
        });
        assert.equal(state.invoicePageOptions.offset, 5);

        await ReportService.getOverdueInvoices('firm-1');
        assert.equal(state.invoicePageOptions.where.status, 'overdue');
        assert.deepEqual(state.invoicePageOptions.where.balance_due, {
            [Sequelize.Op.gt]: 0
        });
    });

    it('rejects invalid pagination values before querying', async () => {
        await assert.rejects(
            ReportService.getUnpaidInvoices('firm-1', { limit: '101' }),
            error => error.statusCode === 400
        );
        assert.equal(state.invoicePageOptions, null);
    });
});
