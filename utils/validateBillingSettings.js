'use strict';

const { validationError } = require('./pagination');
const filterAllowedFields = require('./filterAllowedFields');

const BILLING_SETTING_FIELDS = [
    'default_currency',
    'invoice_prefix',
    'default_due_days',
    'default_tax_rate',
    'payment_instructions',
    'invoice_footer',
    'default_notes'
];

function validateBillingSettings(data, partial = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw validationError('Request body must be a JSON object');
    }

    data = filterAllowedFields(data, BILLING_SETTING_FIELDS);
    if (partial && Object.keys(data).length === 0) {
        throw validationError('At least one billing setting must be provided');
    }

    if (!partial || data.default_currency !== undefined) {
        if (typeof data.default_currency !== 'string') {
            throw validationError('default_currency is required');
        }
        data.default_currency = data.default_currency.trim().toUpperCase();
        if (!['LKR', 'USD', 'GBP'].includes(data.default_currency)) {
            throw validationError('default_currency must be LKR, USD, or GBP');
        }
    }

    if (!partial || data.invoice_prefix !== undefined) {
        if (typeof data.invoice_prefix !== 'string' || data.invoice_prefix.trim() === '') {
            throw validationError('invoice_prefix is required');
        }
        data.invoice_prefix = data.invoice_prefix.trim();
        if (data.invoice_prefix.length > 20) {
            throw validationError('invoice_prefix must be at most 20 characters');
        }
    }

    if (!partial || data.default_due_days !== undefined) {
        const dueDays = data.default_due_days;
        if (
            !(
                (typeof dueDays === 'number' && Number.isSafeInteger(dueDays)) ||
                (typeof dueDays === 'string' && /^\d+$/.test(dueDays))
            ) ||
            Number(dueDays) < 0 ||
            !Number.isSafeInteger(Number(dueDays))
        ) {
            throw validationError('default_due_days must be a non-negative integer');
        }
        data.default_due_days = Number(dueDays);
    }

    if (!partial || data.default_tax_rate !== undefined) {
        const taxRate = data.default_tax_rate;
        if (
            (typeof taxRate !== 'number' && typeof taxRate !== 'string') ||
            !/^\d{1,3}(\.\d{1,4})?$/.test(String(taxRate))
        ) {
            throw validationError('default_tax_rate must be between 0 and 999.9999');
        }
        data.default_tax_rate = String(taxRate);
    }

    for (const field of ['payment_instructions', 'invoice_footer', 'default_notes']) {
        if (data[field] != null && typeof data[field] !== 'string') {
            throw validationError(`${field} must be a string or null`);
        }
        if (data[field] !== undefined && typeof data[field] === 'string') {
            data[field] = data[field].trim();
        }
        if (!partial && data[field] === undefined) {
            data[field] = null;
        }
    }

    return data;
}

module.exports = validateBillingSettings;
