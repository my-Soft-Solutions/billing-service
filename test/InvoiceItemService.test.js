'use strict';

const assert = require('node:assert/strict');
const { beforeEach, describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = {};
const itemModel = {
    bulkCreate: async (items, options) => {
        state.bulkCreateArgs = { items, options };
        return items;
    },
    destroy: async options => {
        state.destroyOptions = options;
    }
};

const InvoiceItemService = loadWithMocks(
    require.resolve('../services/InvoiceItemService'),
    { '../models': { InvoiceItem: itemModel } }
);

beforeEach(() => {
    state.bulkCreateArgs = null;
    state.destroyOptions = null;
});

describe('InvoiceItemService', () => {
    it('validates, normalizes, and calculates invoice items', () => {
        const [item] = InvoiceItemService.prepareItems([{
            description: '  Legal consultation ',
            billing_type: 'hourly',
            quantity: '1.50',
            unit_price: '2.50',
            ignored: 'discarded'
        }]);

        assert.equal(item.description, 'Legal consultation');
        assert.equal(item.billing_type, 'hourly');
        assert.equal(item.quantity, '1.50');
        assert.equal(item.unit_price, '2.50');
        assert.equal(item.amount, '3.75');
        assert.equal(item.amountCents, 375);
        assert.ok(item.id);
        assert.equal(Object.hasOwn(item, 'ignored'), false);
    });

    it('rejects invalid item collections, records, billing types, and amounts', () => {
        const invalidInputs = [
            null,
            [{}],
            [{ description: 'Work', billing_type: 'fixed', quantity: '0', unit_price: '1' }],
            [{ description: 'Work', billing_type: 'monthly', quantity: '1', unit_price: '1' }],
            [{ description: 'Work', billing_type: 'fixed', quantity: '1.001', unit_price: '1' }]
        ];

        assert.throws(() => InvoiceItemService.prepareItems(invalidInputs[0]), {
            statusCode: 400
        });
        for (const items of invalidInputs.slice(1)) {
            assert.throws(() => InvoiceItemService.prepareItems(items), {
                statusCode: 400
            });
        }
    });

    it('creates item rows without the internal cents field and skips empty inserts', async () => {
        const items = InvoiceItemService.prepareItems([{
            description: 'Work',
            billing_type: 'fixed',
            quantity: '1',
            unit_price: '10'
        }]);
        const inserted = await InvoiceItemService.createForInvoice('invoice-1', items, 'tx');

        assert.equal(inserted.length, 1);
        assert.equal(state.bulkCreateArgs.items[0].invoice_id, 'invoice-1');
        assert.equal(Object.hasOwn(state.bulkCreateArgs.items[0], 'amountCents'), false);
        assert.equal(state.bulkCreateArgs.options.transaction, 'tx');

        state.bulkCreateArgs = null;
        assert.deepEqual(await InvoiceItemService.createForInvoice('invoice-1', [], 'tx'), []);
        assert.equal(state.bulkCreateArgs, null);
    });

    it('deletes old rows and inserts replacement rows with fresh identifiers', async () => {
        const item = {
            id: 'old-item-id',
            description: 'Replacement',
            billing_type: 'fixed',
            quantity: '1.00',
            unit_price: '5.00',
            amount: '5.00',
            amountCents: 500
        };

        await InvoiceItemService.replaceForInvoice('invoice-1', [item], 'tx');

        assert.deepEqual(state.destroyOptions, {
            where: { invoice_id: 'invoice-1' },
            transaction: 'tx',
            force: true
        });
        assert.notEqual(state.bulkCreateArgs.items[0].id, 'old-item-id');
        assert.equal(state.bulkCreateArgs.items[0].invoice_id, 'invoice-1');
    });
});
