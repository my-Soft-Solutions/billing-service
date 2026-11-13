'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const PaymentReceiptPdfService = require('../services/PaymentReceiptPdfService');

function extractText(pdf) {
    return [...pdf.matchAll(/<([0-9a-f]+)>/g)]
        .map(([, hex]) => Buffer.from(hex, 'hex').toString('ascii'))
        .join('\n');
}

function makePayment(overrides = {}) {
    return {
        id: 'payment-123',
        payment_reference: 'REF-123',
        payment_date: '2026-11-13',
        amount: '75.50',
        payment_method: 'bank_transfer',
        status: 'recorded',
        received_by: 'user-123',
        ...overrides
    };
}

function makeInvoice(overrides = {}) {
    return {
        invoice_number: 'INV-2026-0012',
        currency: 'USD',
        client_name: 'Example Client',
        client_email: 'client@example.com',
        ...overrides
    };
}

describe('PaymentReceiptPdfService', () => {
    it('generates a PDF receipt with payment and invoice details', () => {
        const pdf = PaymentReceiptPdfService.generate(makePayment(), makeInvoice());
        const text = extractText(pdf.toString('ascii'));

        assert.ok(Buffer.isBuffer(pdf));
        assert.match(pdf.toString('ascii'), /^%PDF-1\.4/);
        assert.match(pdf.toString('ascii'), /%%EOF$/);
        assert.match(text, /PAYMENT RECEIPT/);
        assert.match(text, /USD 75\.50/);
        assert.match(text, /Bank transfer/);
        assert.match(text, /REF-123/);
        assert.match(text, /INV-2026-0012/);
        assert.match(text, /Example Client/);
    });

    it('uses the payment id when there is no payment reference', () => {
        const pdf = PaymentReceiptPdfService.generate(
            makePayment({ payment_reference: null }),
            makeInvoice()
        ).toString('ascii');
        const text = extractText(pdf);

        assert.match(text, /Receipt no\. payment-123/);
        assert.match(text, /Payment reference: -/);
    });

    it('creates continuation pages for long receipt fields', () => {
        const pdf = PaymentReceiptPdfService.generate(
            makePayment(),
            makeInvoice({ client_name: 'Client '.repeat(400) })
        );
        const source = pdf.toString('ascii');
        const text = extractText(source);

        assert.match(source, /\/Count 2/);
        assert.match(text, /PAYMENT RECEIPT \(CONTINUED\)/);
        assert.match(text, /Page 2 of 2/);
    });

    it('rejects non-ASCII receipt text rather than corrupting the PDF', () => {
        assert.throws(
            () => PaymentReceiptPdfService.generate(
                makePayment({ payment_reference: 'Réf-123' }),
                makeInvoice()
            ),
            error => error.statusCode === 422
        );
    });
});
