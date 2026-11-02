'use strict';

const { randomUUID } = require('crypto');
const { InvoiceItem } = require('../models');
const InvoiceCalculationService = require('./InvoiceCalculationService');
const filterAllowedFields = require('../utils/filterAllowedFields');
const { INVOICE_ITEM_FIELDS } = require('../utils/allowedFields');
const { validationError } = require('../utils/pagination');

const BILLING_TYPES = ['fixed', 'hourly'];

function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw validationError(`${field} is required`);
    }
    return value.trim();
}

class InvoiceItemService {
    prepareItems(items) {
        if (!Array.isArray(items)) throw validationError('items must be an array');

        return items.map((item, index) => {
            if (!item || typeof item !== 'object' || Array.isArray(item)) {
                throw validationError(`items[${index}] must be an object`);
            }
            const allowedItem = filterAllowedFields(item, INVOICE_ITEM_FIELDS);
            const description = requiredString(allowedItem.description, `items[${index}].description`);
            if (description.length > 255) {
                throw validationError(`items[${index}].description must not exceed 255 characters`);
            }
            const billingType = requiredString(allowedItem.billing_type, `items[${index}].billing_type`);
            if (!BILLING_TYPES.includes(billingType)) {
                throw validationError(`items[${index}].billing_type must be fixed or hourly`);
            }
            const quantityCents = InvoiceCalculationService.moneyInCents(
                allowedItem.quantity,
                `items[${index}].quantity`
            );
            if (quantityCents < 1 || quantityCents > 9999999999) {
                throw validationError(`items[${index}].quantity is outside the supported range`);
            }
            const unitPriceCents = InvoiceCalculationService.moneyInCents(
                allowedItem.unit_price,
                `items[${index}].unit_price`
            );
            const amountCents = InvoiceCalculationService.calculateItemAmount(
                quantityCents,
                unitPriceCents,
                `items[${index}]`
            );
            return {
                id: randomUUID(),
                description,
                billing_type: billingType,
                quantity: InvoiceCalculationService.amountFromCents(quantityCents),
                unit_price: InvoiceCalculationService.amountFromCents(unitPriceCents),
                amount: InvoiceCalculationService.amountFromCents(amountCents),
                amountCents
            };
        });
    }

    async createForInvoice(invoiceId, items, transaction) {
        if (!items.length) return [];
        return InvoiceItem.bulkCreate(items.map(({ amountCents, ...item }) => ({
            ...item,
            invoice_id: invoiceId
        })), { transaction });
    }

    async replaceForInvoice(invoiceId, items, transaction) {
        await InvoiceItem.destroy({
            where: { invoice_id: invoiceId },
            transaction,
            force: true
        });
        return this.createForInvoice(
            invoiceId,
            items.map(item => ({ ...item, id: randomUUID() })),
            transaction
        );
    }
}

module.exports = new InvoiceItemService();
