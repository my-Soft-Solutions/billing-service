'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const InvoiceCalculationService = require('../services/InvoiceCalculationService');

describe('InvoiceCalculationService', () => {
    it('converts money to cents and formats cents as a decimal amount', () => {
        assert.equal(InvoiceCalculationService.moneyInCents('123.45', 'amount'), 12345);
        assert.equal(InvoiceCalculationService.amountFromCents(12345), '123.45');
    });

    it('rejects invalid precision, negative values, and unsafe amounts', () => {
        for (const value of ['-1.00', '1.234', 'not-money', '90071992547410']) {
            assert.throws(
                () => InvoiceCalculationService.moneyInCents(value, 'amount'),
                error => error.statusCode === 400
            );
        }
    });

    it('calculates item amounts with cent precision', () => {
        assert.equal(InvoiceCalculationService.calculateItemAmount(250, 199, 'item'), 498);
    });

    it('calculates percentage tax after discount and rounds to cents', () => {
        const items = [{ amountCents: 10000 }];

        assert.equal(
            InvoiceCalculationService.calculatePercentageTax(items, '25.00', '8.5'),
            '6.38'
        );
    });

    it('caps the taxable base at zero and rejects invalid tax rates', () => {
        assert.equal(
            InvoiceCalculationService.calculatePercentageTax([{ amountCents: 100 }], '2.00', '5'),
            '0.00'
        );
        assert.throws(
            () => InvoiceCalculationService.calculatePercentageTax([], '0', '1000'),
            error => error.statusCode === 400
        );
    });

    it('calculates invoice totals and rejects discounts beyond the total', () => {
        const totals = InvoiceCalculationService.calculateTotals(
            [{ amountCents: 10000 }],
            '5.00',
            '2.50'
        );

        assert.deepEqual(totals, {
            subtotal: '100.00',
            discount_amount: '5.00',
            tax_amount: '2.50',
            total_amount: '97.50',
            paid_amount: '0.00',
            balance_due: '97.50'
        });
        assert.throws(
            () => InvoiceCalculationService.calculateTotals([{ amountCents: 100 }], '2.00', '0'),
            error => error.statusCode === 400
        );
    });
});
