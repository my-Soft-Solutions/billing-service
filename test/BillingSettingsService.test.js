'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const settingsModel = {
    findOne: async options => {
        state.findOptions = options;
        return state.settings;
    },
    create: async values => {
        state.createdValues = values;
        return values;
    }
};
const BillingSettingsService = loadWithMocks(
    require.resolve('../services/BillingSettingsService'),
    { '../models': { InvoiceSetting: settingsModel } }
);

function validSettings() {
    return {
        default_currency: ' usd ',
        invoice_prefix: ' BILL ',
        default_due_days: '30',
        default_tax_rate: 8.5,
        payment_instructions: '  Pay by transfer  ',
        invoice_footer: '  Thank you  ',
        default_notes: '  Standard note  '
    };
}

beforeEach(() => {
    state.settings = null;
    state.findOptions = null;
    state.createdValues = null;
    settingsModel.create = async values => {
        state.createdValues = values;
        return values;
    };
});

describe('BillingSettingsService', () => {
    it('gets settings for a law firm', async () => {
        state.settings = { id: 'settings-1' };

        assert.equal(await BillingSettingsService.get('firm-1'), state.settings);
        assert.deepEqual(state.findOptions, { where: { law_firm_id: 'firm-1' } });
    });

    it('creates normalized settings for a firm', async () => {
        const result = await BillingSettingsService.create('firm-1', validSettings());

        assert.equal(result, state.createdValues);
        assert.equal(result.law_firm_id, 'firm-1');
        assert.ok(result.id);
        assert.equal(result.default_currency, 'USD');
        assert.equal(result.invoice_prefix, 'BILL');
        assert.equal(result.default_due_days, 30);
        assert.equal(result.default_tax_rate, '8.5');
        assert.equal(result.payment_instructions, 'Pay by transfer');
        assert.equal(result.default_notes, 'Standard note');
    });

    it('rejects duplicate settings and maps a unique constraint race to a conflict', async () => {
        state.settings = { id: 'existing' };
        await assert.rejects(
            BillingSettingsService.create('firm-1', validSettings()),
            error => error.statusCode === 409
        );

        state.settings = null;
        settingsModel.create = async () => {
            const error = new Error('duplicate key');
            error.name = 'SequelizeUniqueConstraintError';
            throw error;
        };
        await assert.rejects(
            BillingSettingsService.create('firm-1', validSettings()),
            error => error.statusCode === 409
        );
        settingsModel.create = async values => {
            state.createdValues = values;
            return values;
        };
    });

    it('updates supplied settings and returns not found for a missing firm setting', async () => {
        let updated;
        state.settings = {
            async update(changes) {
                updated = changes;
                Object.assign(this, changes);
            }
        };
        const result = await BillingSettingsService.update('firm-1', {
            default_currency: 'gbp'
        });

        assert.equal(result, state.settings);
        assert.deepEqual(updated, { default_currency: 'GBP' });

        state.settings = null;
        await assert.rejects(
            BillingSettingsService.update('firm-1', { invoice_prefix: 'NEW' }),
            error => error.statusCode === 404
        );
    });

    it('surfaces invalid setting input without accessing storage', async () => {
        await assert.rejects(
            BillingSettingsService.create('firm-1', { default_currency: 'EUR' }),
            error => error.statusCode === 400
        );
    });
});
