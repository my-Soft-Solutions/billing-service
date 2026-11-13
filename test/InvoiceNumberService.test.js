'use strict';

const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const sequence = {
    last_number: '9',
    update: async (values, options) => {
        state.sequenceUpdate = { values, options };
    }
};
const models = {
    Invoice: {
        findOne: async options => {
            state.invoiceLookup = options;
            return state.existingInvoice;
        }
    },
    InvoiceNumberSequence: {
        findOrCreate: async options => {
            state.findOrCreateOptions = options;
        },
        findOne: async options => {
            state.sequenceLookup = options;
            return state.sequence;
        }
    }
};

const InvoiceNumberService = loadWithMocks(
    require.resolve('../services/InvoiceNumberService'),
    { '../models': models }
);

describe('InvoiceNumberService', () => {
    it('creates and locks the yearly sequence before generating the next number', async () => {
        const transaction = { LOCK: { UPDATE: 'UPDATE' } };
        state.sequence = sequence;
        state.sequenceUpdate = null;

        const number = await InvoiceNumberService.generate('firm-1', transaction, 'BILL');
        const year = new Date().toISOString().slice(0, 4);

        assert.equal(number, `BILL-${year}-0010`);
        assert.equal(state.findOrCreateOptions.where.law_firm_id, 'firm-1');
        assert.equal(state.findOrCreateOptions.where.sequence_year, Number(year));
        assert.equal(state.sequenceLookup.lock, transaction.LOCK.UPDATE);
        assert.equal(state.sequenceUpdate.values.last_number, '10');
    });

    it('throws when the sequence cannot be loaded or the generated value is too long', async () => {
        state.sequence = null;
        await assert.rejects(
            InvoiceNumberService.generate('firm-1', { LOCK: { UPDATE: 'UPDATE' } }),
            /sequence could not be loaded/
        );

        state.sequence = sequence;
        await assert.rejects(
            InvoiceNumberService.generate('firm-1', { LOCK: { UPDATE: 'UPDATE' } }, 'x'.repeat(50)),
            error => error.statusCode === 400
        );
    });

    it('trims valid manual invoice numbers and rejects empty or overlong values', () => {
        assert.equal(InvoiceNumberService.validate('  INV-1  '), 'INV-1');
        assert.throws(() => InvoiceNumberService.validate('  '), { statusCode: 400 });
        assert.throws(() => InvoiceNumberService.validate('x'.repeat(51)), { statusCode: 400 });
    });

    it('checks uniqueness within a firm and excludes an updated invoice id', async () => {
        state.existingInvoice = null;
        await InvoiceNumberService.assertUnique('firm-1', 'INV-1', 'tx', 'invoice-1');

        assert.equal(state.invoiceLookup.where.law_firm_id, 'firm-1');
        assert.equal(state.invoiceLookup.where.invoice_number, 'INV-1');
        assert.equal(state.invoiceLookup.where.id[Op.ne], 'invoice-1');
        assert.equal(state.invoiceLookup.paranoid, false);

        state.existingInvoice = { id: 'duplicate' };
        await assert.rejects(
            InvoiceNumberService.assertUnique('firm-1', 'INV-1', 'tx'),
            error => error.statusCode === 409
        );
    });
});
