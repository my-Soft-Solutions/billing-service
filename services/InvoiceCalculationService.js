'use strict';

const { validationError } = require('../utils/pagination');

class InvoiceCalculationService {
    moneyInCents(value, field) {
        const text = String(value);
        if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
            throw validationError(`${field} must be a non-negative amount with at most two decimal places`);
        }
        const [whole, fraction = ''] = text.split('.');
        const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
        if (!Number.isSafeInteger(cents)) {
            throw validationError(`${field} exceeds the supported amount`);
        }
        return cents;
    }

    amountFromCents(value) {
        return (value / 100).toFixed(2);
    }

    calculateItemAmount(quantityCents, unitPriceCents, field) {
        const amountCents = Math.round((quantityCents * unitPriceCents) / 100);
        if (!Number.isSafeInteger(amountCents) || amountCents > 99999999999999) {
            throw validationError(`${field} amount exceeds the supported range`);
        }
        return amountCents;
    }

    calculatePercentageTax(items, discount, rate) {
        const rateText = String(rate);
        if (!/^\d{1,3}(?:\.\d{1,4})?$/.test(rateText)) {
            throw validationError('default_tax_rate must be between 0 and 999.9999');
        }
        const [whole, fraction = ''] = rateText.split('.');
        const rateTenThousandths = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
        const subtotalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
        const discountCents = this.moneyInCents(discount, 'discount_amount');
        const taxableCents = BigInt(Math.max(0, subtotalCents - discountCents));
        const taxCents = (taxableCents * rateTenThousandths + 500000n) / 1000000n;
        if (taxCents > 99999999999999n) {
            throw validationError('Tax amount exceeds the supported range');
        }
        return this.amountFromCents(Number(taxCents));
    }

    calculateTotals(items, discount, tax) {
        const subtotalCents = items.reduce((sum, item) => sum + item.amountCents, 0);
        const discountCents = this.moneyInCents(discount, 'discount_amount');
        const taxCents = this.moneyInCents(tax, 'tax_amount');
        const totalCents = subtotalCents - discountCents + taxCents;
        if (totalCents < 0) throw validationError('discount_amount cannot exceed subtotal plus tax');
        if (![subtotalCents, totalCents].every(value =>
            Number.isSafeInteger(value) && value <= 99999999999999
        )) {
            throw validationError('Invoice total exceeds the supported amount');
        }
        return {
            subtotal: this.amountFromCents(subtotalCents),
            discount_amount: this.amountFromCents(discountCents),
            tax_amount: this.amountFromCents(taxCents),
            total_amount: this.amountFromCents(totalCents),
            paid_amount: '0.00',
            balance_due: this.amountFromCents(totalCents)
        };
    }
}

module.exports = new InvoiceCalculationService();
