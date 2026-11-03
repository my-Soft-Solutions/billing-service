'use strict';

const InvoiceCalculationService = require('../services/InvoiceCalculationService');
const { validationError } = require('./pagination');
const validateDate = require('./dateValidator');

const PAYMENT_METHODS = ['cash', 'bank_transfer', 'cheque', 'card'];
const PAYMENT_STATUSES = ['recorded', 'voided'];

function validatePaymentData(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw validationError('Request body must be a JSON object');
    }

    if (typeof data.invoice_id !== 'string' || data.invoice_id.trim() === '') {
        throw validationError('invoice_id is required');
    }
    if (data.payment_date === undefined || data.payment_date === null || data.payment_date === '') {
        throw validationError('payment_date is required');
    }
    const paymentDate = validateDate(data.payment_date, 'payment_date');
    if (typeof data.payment_method !== 'string' || !PAYMENT_METHODS.includes(data.payment_method)) {
        throw validationError('Invalid payment_method');
    }
    if (typeof data.amount !== 'string' && typeof data.amount !== 'number') {
        throw validationError('amount must be a positive amount with at most two decimal places');
    }
    const amountCents = InvoiceCalculationService.moneyInCents(data.amount, 'amount');
    if (amountCents <= 0) {
        throw validationError('amount must be greater than zero');
    }
    if (data.payment_reference != null && typeof data.payment_reference !== 'string') {
        throw validationError('payment_reference must be a string or null');
    }
    if (typeof data.payment_reference === 'string' && data.payment_reference.length > 100) {
        throw validationError('payment_reference must not exceed 100 characters');
    }
    if (data.notes != null && typeof data.notes !== 'string') {
        throw validationError('notes must be a string or null');
    }

    return {
        invoice_id: data.invoice_id.trim(),
        payment_date: paymentDate,
        amount: InvoiceCalculationService.amountFromCents(amountCents),
        amountCents,
        payment_method: data.payment_method,
        payment_reference: data.payment_reference ?? null,
        notes: data.notes ?? null
    };
}

function cents(value, field) {
    return InvoiceCalculationService.moneyInCents(value, field);
}

function invoiceStatusForBalance(invoice, paidCents, totalCents) {
    if (paidCents >= totalCents) return 'paid';
    if (paidCents > 0) return 'partially_paid';
    if (invoice.due_date && invoice.due_date < new Date().toISOString().slice(0, 10)) {
        return 'overdue';
    }
    return 'issued';
}

module.exports = {
    PAYMENT_STATUSES,
    cents,
    invoiceStatusForBalance,
    validatePaymentData
};
