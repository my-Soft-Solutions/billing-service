'use strict';

const { validationError } = require('./pagination');
const filterAllowedFields = require('./filterAllowedFields');
const { INVOICE_FIELDS } = require('./allowedFields');

function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw validationError(`${field} is required`);
    }
    return value.trim();
}

function validateInvoiceData(data, partial = false) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw validationError('Request body must be a JSON object');
    }

    data = filterAllowedFields(data, INVOICE_FIELDS);
    if (!partial || data.client_id !== undefined) {
        data.client_id = requiredString(data.client_id, 'client_id');
    }
    if (!partial || data.currency !== undefined) {
        data.currency = requiredString(data.currency, 'currency').toUpperCase();
        if (!/^[A-Z]{3}$/.test(data.currency)) {
            throw validationError('currency must be a three-letter code');
        }
    }
    if (data.case_id != null && typeof data.case_id !== 'string') {
        throw validationError('case_id must be a string or null');
    }
    if (data.notes != null && typeof data.notes !== 'string') {
        throw validationError('notes must be a string or null');
    }

    return data;
}

module.exports = validateInvoiceData;
