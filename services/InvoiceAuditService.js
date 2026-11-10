'use strict';

const { randomUUID } = require('crypto');
const { Invoice, InvoiceAuditLog } = require('../models');
const { parsePaginationValue } = require('../utils/pagination');

class InvoiceAuditService {
    async record({
        invoiceId,
        firmId,
        userId,
        action,
        oldValues = null,
        newValues = null,
        metadata = null,
        transaction
    }) {
        return InvoiceAuditLog.create({
            id: randomUUID(),
            invoice_id: invoiceId,
            law_firm_id: firmId,
            user_id: userId,
            action,
            old_values: oldValues,
            new_values: newValues,
            metadata,
            createdAt: new Date()
        }, { transaction });
    }

    async list(invoiceId, firmId, filters = {}) {
        const page = parsePaginationValue(filters.page, 1, 'page');
        const limit = parsePaginationValue(filters.limit, 20, 'limit', 100);
        const invoice = await Invoice.findOne({
            where: { id: invoiceId, law_firm_id: firmId },
            attributes: ['id']
        });

        if (!invoice) {
            const error = new Error('Invoice not found');
            error.statusCode = 404;
            throw error;
        }

        const result = await InvoiceAuditLog.findAndCountAll({
            where: { invoice_id: invoiceId, law_firm_id: firmId },
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit
        });

        return {
            data: result.rows,
            pagination: {
                page,
                limit,
                total: result.count,
                totalPages: Math.ceil(result.count / limit)
            }
        };
    }
}

module.exports = new InvoiceAuditService();
