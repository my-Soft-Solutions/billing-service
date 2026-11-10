'use strict';

const { randomUUID } = require('crypto');
const { Payment, sequelize } = require('../models');
const InvoiceService = require('./InvoiceService');
const InvoiceAuditService = require('./InvoiceAuditService');
const InvoiceCalculationService = require('./InvoiceCalculationService');
const { getStringFilter, parsePaginationValue, validationError } = require('../utils/pagination');
const {
    PAYMENT_STATUSES,
    cents,
    invoiceStatusForBalance,
    validatePaymentData
} = require('../utils/paymentUtils');

class PaymentService {
    async findById(id, firmId) {
        return Payment.findOne({ where: { id, law_firm_id: firmId } });
    }

    async create(firmId, userId, data) {
        const paymentData = validatePaymentData(data);

        return sequelize.transaction(async transaction => {
            const invoice = await InvoiceService.requireById(
                paymentData.invoice_id,
                firmId,
                transaction,
                { lock: transaction.LOCK.UPDATE }
            );
            if (!['issued', 'partially_paid', 'overdue'].includes(invoice.status)) {
                const error = new Error('Payments can only be recorded for issued invoices');
                error.statusCode = 409;
                throw error;
            }

            const totalCents = cents(invoice.total_amount, 'invoice total');
            const currentPaidCents = cents(invoice.paid_amount, 'paid amount');
            const balanceCents = totalCents - currentPaidCents;
            if (paymentData.amountCents > balanceCents) {
                throw validationError('amount cannot exceed the invoice balance');
            }

            const oldInvoiceValues = {
                status: invoice.status,
                paid_amount: invoice.paid_amount,
                balance_due: invoice.balance_due
            };
            const payment = await Payment.create({
                id: randomUUID(),
                law_firm_id: firmId,
                invoice_id: invoice.id,
                payment_reference: paymentData.payment_reference,
                payment_date: paymentData.payment_date,
                amount: paymentData.amount,
                payment_method: paymentData.payment_method,
                status: 'recorded',
                notes: paymentData.notes,
                received_by: userId
            }, { transaction });

            const paidCents = currentPaidCents + paymentData.amountCents;
            const updatedInvoiceValues = {
                paid_amount: InvoiceCalculationService.amountFromCents(paidCents),
                balance_due: InvoiceCalculationService.amountFromCents(totalCents - paidCents),
                status: invoiceStatusForBalance(invoice, paidCents, totalCents)
            };
            await invoice.update(updatedInvoiceValues, { transaction });
            await InvoiceAuditService.record({
                invoiceId: invoice.id,
                firmId,
                userId,
                action: 'payment_recorded',
                oldValues: oldInvoiceValues,
                newValues: {
                    payment: payment.get({ plain: true }),
                    invoice: updatedInvoiceValues
                },
                metadata: { payment_id: payment.id },
                transaction
            });

            return payment;
        });
    }

    async list(firmId, filters = {}) {
        const page = parsePaginationValue(filters.page, 1, 'page');
        const limit = parsePaginationValue(filters.limit, 20, 'limit', 100);
        const where = { law_firm_id: firmId };
        const invoiceId = getStringFilter(filters, 'invoice_id');
        const status = getStringFilter(filters, 'status');

        if (invoiceId !== undefined) where.invoice_id = invoiceId;
        if (status !== undefined) {
            if (!PAYMENT_STATUSES.includes(status)) throw validationError('Invalid payment status');
            where.status = status;
        }

        const result = await Payment.findAndCountAll({
            where,
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

    async void(id, firmId, userId) {
        return sequelize.transaction(async transaction => {
            const payment = await Payment.findOne({
                where: { id, law_firm_id: firmId },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
            if (!payment) {
                const error = new Error('Payment not found');
                error.statusCode = 404;
                throw error;
            }
            if (payment.status !== 'recorded') {
                const error = new Error('Only recorded payments can be voided');
                error.statusCode = 409;
                throw error;
            }

            const invoice = await InvoiceService.requireById(
                payment.invoice_id,
                firmId,
                transaction,
                { lock: transaction.LOCK.UPDATE }
            );

            const oldPaymentValues = payment.get({ plain: true });
            const oldInvoiceValues = {
                status: invoice.status,
                paid_amount: invoice.paid_amount,
                balance_due: invoice.balance_due
            };
            await payment.update({ status: 'voided' }, { transaction });
            const recordedPayments = await Payment.findAll({
                where: {
                    invoice_id: invoice.id,
                    law_firm_id: firmId,
                    status: 'recorded'
                },
                attributes: ['amount'],
                transaction
            });
            const paidCents = recordedPayments.reduce(
                (total, recordedPayment) => total + cents(recordedPayment.amount, 'payment amount'),
                0
            );
            const totalCents = cents(invoice.total_amount, 'invoice total');

            const updatedInvoiceValues = {
                paid_amount: InvoiceCalculationService.amountFromCents(paidCents),
                balance_due: InvoiceCalculationService.amountFromCents(totalCents - paidCents),
                status: invoice.status === 'cancelled'
                    ? 'cancelled'
                    : invoiceStatusForBalance(invoice, paidCents, totalCents)
            };
            await invoice.update(updatedInvoiceValues, { transaction });
            await InvoiceAuditService.record({
                invoiceId: invoice.id,
                firmId,
                userId,
                action: 'payment_voided',
                oldValues: {
                    payment: oldPaymentValues,
                    invoice: oldInvoiceValues
                },
                newValues: {
                    payment: payment.get({ plain: true }),
                    invoice: updatedInvoiceValues
                },
                metadata: { payment_id: payment.id },
                transaction
            });

            return payment;
        });
    }
}

module.exports = new PaymentService();
