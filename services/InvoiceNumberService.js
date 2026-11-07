'use strict';

const { randomUUID } = require('crypto');
const { Op } = require('sequelize');
const { Invoice, InvoiceNumberSequence } = require('../models');
const { validationError } = require('../utils/pagination');

class InvoiceNumberService {
    async generate(firmId, transaction, prefix = 'INV') {
        const year = Number(new Date().toISOString().slice(0, 4));
        const where = { law_firm_id: firmId, sequence_year: year };
        await InvoiceNumberSequence.findOrCreate({
            where,
            defaults: {
                id: randomUUID(),
                ...where,
                last_number: 0
            },
            transaction
        });

        const sequence = await InvoiceNumberSequence.findOne({
            where,
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!sequence) {
            throw new Error('Invoice number sequence could not be loaded');
        }

        const nextNumber = BigInt(sequence.last_number) + 1n;
        await sequence.update({ last_number: nextNumber.toString() }, { transaction });

        const invoiceNumber = `${prefix}-${year}-${String(nextNumber).padStart(4, '0')}`;
        if (invoiceNumber.length > 50) {
            throw validationError('Generated invoice number exceeds the supported length');
        }
        return invoiceNumber;
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
