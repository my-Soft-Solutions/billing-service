'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const InvoicePdfService = require('../services/InvoicePdfService');

function makeInvoice(overrides = {}) {
    return {
        invoice_number: 'INV-2026-0001',
        status: 'partially_paid',
        client_name: 'Example Client',
        client_email: 'client@example.com',
        client_phone: null,
        issue_date: '2026-01-01',
        due_date: '2026-02-01',
        currency: 'USD',
        balance_due: '50.00',
        items: [{
            description: 'Consulting',
            billing_type: 'hourly',
            quantity: '2.00',
            unit_price: '25.00',
            amount: '50.00'
        }],
        subtotal: '50.00',
        discount_amount: '0.00',
        tax_rate: null,
        tax_amount: '0.00',
        total_amount: '50.00',
        paid_amount: '0.00',
        notes: 'Thank you',
        payment_instructions: null,
        invoice_footer: null,
        ...overrides
    };
}

function extractText(pdf) {
    return [...pdf.matchAll(/<([0-9a-f]+)>/g)]
        .map(([, hex]) => Buffer.from(hex, 'hex').toString('ascii'))
        .join('\n');
}

describe('InvoicePdfService', () => {
    it('generates a PDF containing invoice details and item rows', () => {
        const pdf = InvoicePdfService.generate(makeInvoice());
        const text = extractText(pdf.toString('ascii'));

        assert.match(pdf.toString('ascii'), /^%PDF-1\.4/);
        assert.match(text, /Invoice no\./);
        assert.match(text, /Example Client/);
        assert.match(text, /Consulting/);
        assert.match(text, /BALANCE DUE/);
        assert.match(pdf.toString('ascii'), /%%EOF$/);
    });

    it('wraps long content onto continuation pages', () => {
        const pdf = InvoicePdfService.generate(makeInvoice({
            items: Array.from({ length: 60 }, (_, index) => ({
                description: `Line item ${index}`,
                billing_type: 'fixed',
                quantity: '1.00',
                unit_price: '1.00',
                amount: '1.00'
            }))
        }));
        const text = extractText(pdf.toString('ascii'));

        assert.match(text, /ITEMS \(CONTINUED\)/);
        assert.match(text, /Page 2 of 4/);
    });

    it('rejects unsupported non-ASCII text', () => {
        assert.throws(
            () => InvoicePdfService.generate(makeInvoice({ client_name: 'Clïent' })),
            error => error.statusCode === 422
        );
    });

    it('wraps text at word boundaries and splits oversized words', () => {
        assert.deepEqual(InvoicePdfService.wrapText('alpha beta gamma', 10), ['alpha beta', 'gamma']);
        assert.deepEqual(InvoicePdfService.wrapText('abcdefghijk', 4), ['abcd', 'efgh', 'ijk']);
        assert.deepEqual(InvoicePdfService.wrapText('  ', 4), ['-']);
    });
});
