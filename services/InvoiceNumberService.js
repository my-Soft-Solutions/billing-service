'use strict';

const { Op } = require('sequelize');
const { Invoice } = require('../models');
const { validationError } = require('../utils/pagination');

class InvoiceNumberService {
    async generate(firmId, transaction) {
        const year = new Date().toISOString().slice(0, 4);
        const prefix = `INV-${year}-`;
        const invoices = await Invoice.findAll({
            attributes: ['invoice_number'],
            where: {
                law_firm_id: firmId,
                invoice_number: { [Op.like]: `${prefix}%` }
            },
            paranoid: false,
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const highestSequence = invoices.reduce((highest, invoice) => {
            const match = invoice.invoice_number.match(/^INV-\d{4}-(\d+)$/);
            if (!match) return highest;
            const sequence = Number(match[1]);
            return Number.isSafeInteger(sequence) ? Math.max(highest, sequence) : highest;
        }, 0);

        return `${prefix}${String(highestSequence + 1).padStart(4, '0')}`;
    }

    validate(invoiceNumber) {
        if (typeof invoiceNumber !== 'string' || invoiceNumber.trim() === '') {
            throw validationError('invoice_number is required');
        }
        const normalizedInvoiceNumber = invoiceNumber.trim();
        if (normalizedInvoiceNumber.length > 50) {
            throw validationError('invoice_number must not exceed 50 characters');
        }
        return normalizedInvoiceNumber;
    }

    async assertUnique(firmId, invoiceNumber, transaction, excludeId) {
        const where = { law_firm_id: firmId, invoice_number: invoiceNumber };
        if (excludeId) where.id = { [Op.ne]: excludeId };
        const existing = await Invoice.findOne({ where, transaction, paranoid: false });
        if (existing) {
            const error = new Error('invoice_number already exists for this law firm');
            error.statusCode = 409;
            throw error;
        }
    }
}

module.exports = new InvoiceNumberService();
