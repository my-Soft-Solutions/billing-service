'use strict';

const { Op } = require('sequelize');
const { Invoice, sequelize } = require('../models');
const InvoiceAuditService = require('./InvoiceAuditService');

class OverdueInvoiceService {
    async markOverdue(asOfDate) {
        return sequelize.transaction(async transaction => {
            const invoices = await Invoice.findAll({
                where: {
                    due_date: { [Op.lt]: asOfDate },
                    balance_due: { [Op.gt]: 0 },
                    status: { [Op.in]: ['issued', 'partially_paid'] }
                },
                attributes: ['id', 'law_firm_id', 'status'],
                transaction,
                lock: transaction.LOCK.UPDATE
            });

            for (const invoice of invoices) {
                const oldStatus = invoice.status;
                await invoice.update({ status: 'overdue' }, { transaction });
                await InvoiceAuditService.record({
                    invoiceId: invoice.id,
                    firmId: invoice.law_firm_id,
                    userId: null,
                    action: 'invoice_marked_overdue',
                    oldValues: { status: oldStatus },
                    newValues: { status: 'overdue' },
                    transaction
                });
            }

            return invoices.length;
        });
    }
}

module.exports = new OverdueInvoiceService();
