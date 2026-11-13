'use strict';

const { randomUUID } = require('crypto');
const emailApiClient = require('../config/axios');
const { Invoice, InvoiceItem, InvoiceSetting, sequelize } = require('../models');
const InvoiceItemService = require('./InvoiceItemService');
const InvoiceCalculationService = require('./InvoiceCalculationService');
const InvoiceNumberService = require('./InvoiceNumberService');
const InvoicePdfService = require('./InvoicePdfService');
const InvoiceAuditService = require('./InvoiceAuditService');
const { parsePaginationValue, getStringFilter, validationError } = require('../utils/pagination');
const validateDate = require('../utils/dateValidator');
const validateInvoiceData = require('../utils/validateInvoiceData');

const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'];

class InvoiceService {
    async findById(id, firmId, transaction, { lock } = {}) {
        return Invoice.findOne({
            where: { id, law_firm_id: firmId },
            include: [{ model: InvoiceItem, as: 'items' }],
            transaction,
            lock
        });
    }

    async requireById(id, firmId, transaction, options) {
        const invoice = await this.findById(id, firmId, transaction, options);
        if (!invoice) {
            const error = new Error('Invoice not found');
            error.statusCode = 404;
            throw error;
        }
        return invoice;
    }

    async create(firmId, userId, data, client) {
        data = validateInvoiceData(data, true);

        const items = InvoiceItemService.prepareItems(data.items === undefined ? [] : data.items);
        const id = randomUUID();

        return sequelize.transaction(async transaction => {
            const settings = await InvoiceSetting.findOne({
                where: { law_firm_id: firmId },
                transaction
            });
            const invoiceData = validateInvoiceData({
                ...data,
                currency: data.currency === undefined
                    ? settings && settings.default_currency
                    : data.currency
            });
            const clientId = invoiceData.client_id;
            const issueDate = validateDate(invoiceData.issue_date, 'issue_date');
            const dueDate = invoiceData.due_date !== undefined
                ? validateDate(invoiceData.due_date, 'due_date')
                : settings
                    ? this.defaultDueDate(issueDate, settings.default_due_days)
                    : null;
            const taxRate = invoiceData.tax_amount === undefined && settings
                ? settings.default_tax_rate
                : null;
            const taxAmount = invoiceData.tax_amount !== undefined
                ? invoiceData.tax_amount
                : taxRate === null
                    ? '0'
                    : InvoiceCalculationService.calculatePercentageTax(
                        items,
                        invoiceData.discount_amount ?? '0',
                        taxRate
                    );
            const totals = InvoiceCalculationService.calculateTotals(
                items,
                invoiceData.discount_amount ?? '0',
                taxAmount
            );
            const invoiceNumber = await InvoiceNumberService.generate(
                firmId,
                transaction,
                settings ? settings.invoice_prefix : 'INV'
            );
            await InvoiceNumberService.assertUnique(firmId, invoiceNumber, transaction);
            await Invoice.create({
                id,
                law_firm_id: firmId,
                client_id: clientId,
                client_name: client.name,
                client_email: client.email,
                client_phone: client.phone,
                case_id: invoiceData.case_id || null,
                invoice_number: invoiceNumber,
                issue_date: issueDate,
                due_date: dueDate,
                currency: invoiceData.currency,
                tax_rate: taxRate,
                payment_instructions: settings ? settings.payment_instructions : null,
                invoice_footer: settings ? settings.invoice_footer : null,
                ...totals,
                status: 'draft',
                notes: invoiceData.notes === undefined
                    ? settings ? settings.default_notes : null
                    : invoiceData.notes,
                created_by: userId
            }, { transaction });

            await InvoiceItemService.createForInvoice(id, items, transaction);
            const invoice = await this.requireById(id, firmId, transaction);
            await InvoiceAuditService.record({
                invoiceId: id,
                firmId,
                userId,
                action: 'invoice_created',
                newValues: invoice.get({ plain: true }),
                transaction
            });
            return invoice;
        });
    }

    defaultDueDate(issueDate, dueDays) {
        const baseDate = issueDate || new Date().toISOString().slice(0, 10);
        const date = new Date(`${baseDate}T00:00:00.000Z`);
        date.setUTCDate(date.getUTCDate() + Number(dueDays));
        if (Number.isNaN(date.getTime())) {
            throw validationError('default_due_days results in an invalid due date');
        }
        return date.toISOString().slice(0, 10);
    }

    async list(firmId, filters = {}) {
        const page = parsePaginationValue(filters.page, 1, 'page');
        const limit = parsePaginationValue(filters.limit, 20, 'limit', 100);
        const where = { law_firm_id: firmId };
        const status = getStringFilter(filters, 'status');
        if (status !== undefined) {
            if (!INVOICE_STATUSES.includes(status)) throw validationError('Invalid invoice status');
            where.status = status;
        }
        const result = await Invoice.findAndCountAll({
            where,
            include: [{ model: InvoiceItem, as: 'items' }],
            order: [['createdAt', 'DESC']],
            limit,
            offset: (page - 1) * limit,
            distinct: true
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

    async update(id, firmId, userId, data) {
        data = validateInvoiceData(data, true);

        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status !== 'draft') {
                const error = new Error('Only draft invoices can be updated');
                error.statusCode = 409;
                throw error;
            }
            const oldValues = invoice.get({ plain: true });

            const items = data.items === undefined
                ? invoice.items.map(item => ({
                    id: item.id,
                    description: item.description,
                    billing_type: item.billing_type,
                    quantity: String(item.quantity),
                    unit_price:  String(item.unit_price),
                    amountCents: InvoiceCalculationService.moneyInCents(item.amount, 'item amount')
                }))
                : InvoiceItemService.prepareItems(data.items);
            const totals = InvoiceCalculationService.calculateTotals(
                items,
                data.discount_amount === undefined ? invoice.discount_amount : data.discount_amount,
                data.tax_amount === undefined ? invoice.tax_amount : data.tax_amount
            );
            const changes = { ...totals };

            if (data.client_id !== undefined) changes.client_id = data.client_id;
            if (data.case_id !== undefined) changes.case_id = data.case_id;
            if (data.issue_date !== undefined) changes.issue_date = validateDate(data.issue_date, 'issue_date');
            if (data.due_date !== undefined) changes.due_date = validateDate(data.due_date, 'due_date');
            if (data.currency !== undefined) changes.currency = data.currency;
            if (data.notes !== undefined) changes.notes = data.notes;
            await invoice.update(changes, { transaction });

            if (data.items !== undefined) {
                await InvoiceItemService.replaceForInvoice(id, items, transaction);
            }
            const updatedInvoice = await this.requireById(id, firmId, transaction);
            await InvoiceAuditService.record({
                invoiceId: id,
                firmId,
                userId,
                action: 'invoice_updated',
                oldValues,
                newValues: updatedInvoice.get({ plain: true }),
                transaction
            });
            return updatedInvoice;
        });
    }

    async issue(id, firmId, userId) {
        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status !== 'draft') {
                const error = new Error('Only draft invoices can be issued');
                error.statusCode = 409;
                throw error;
            }
            if (!invoice.items.length) throw validationError('Add at least one item before issuing an invoice');
            const oldValues = {
                status: invoice.status,
                issue_date: invoice.issue_date
            };
            await invoice.update({
                status: 'issued',
                issue_date: invoice.issue_date || new Date().toISOString().slice(0, 10)
            }, { transaction });
            const issuedInvoice = await this.requireById(id, firmId, transaction);
            await InvoiceAuditService.record({
                invoiceId: id,
                firmId,
                userId,
                action: 'invoice_issued',
                oldValues,
                newValues: {
                    status: issuedInvoice.status,
                    issue_date: issuedInvoice.issue_date
                },
                transaction
            });
            return issuedInvoice;
        });
    }

    async sendEmail(id, firmId, userId, authorization) {
        const invoice = await this.requireById(id, firmId);
        if (invoice.status === 'draft' || invoice.status === 'cancelled') {
            const error = new Error('Only active invoices can be emailed');
            error.statusCode = 409;
            throw error;
        }
        if (invoice.email_sent) {
            const error = new Error('Invoice email has already been sent');
            error.statusCode = 409;
            throw error;
        }

        const pdf = InvoicePdfService.generate(invoice);
        try {
            emailApiClient.setAuthorizationHeader(authorization);
            await emailApiClient.post(
                process.env.INVOICE_EMAIL_API_URL || 'http://localhost:3000/api/v1/emails/send',
                {
                    to: invoice.client_email,
                    subject: `Invoice ${invoice.invoice_number}`,
                    text: `Please find invoice ${invoice.invoice_number} for ${invoice.currency} ${invoice.total_amount}.`,
                    invoice: invoice.get({ plain: true }),
                    attachments: [{
                        filename: `invoice-${invoice.invoice_number}.pdf`,
                        contentType: 'application/pdf',
                        encoding: 'base64',
                        content: pdf.toString('base64')
                    }]
                }
            );
        } catch (cause) {
            console.error('Invoice email API request failed:', cause.message);
            const error = new Error('Invoice email API request failed');
            error.statusCode = 502;
            throw error;
        } finally {
            emailApiClient.setAuthorizationHeader(null);
        }

        return sequelize.transaction(async transaction => {
            const currentInvoice = await this.requireById(id, firmId, transaction);
            const oldValues = {
                email_sent: currentInvoice.email_sent,
                email_sent_at: currentInvoice.email_sent_at
            };
            const emailSentAt = new Date();
            await currentInvoice.update({
                email_sent: true,
                email_sent_at: emailSentAt
            }, { transaction });
            const updatedInvoice = await this.requireById(id, firmId, transaction);
            await InvoiceAuditService.record({
                invoiceId: id,
                firmId,
                userId,
                action: 'invoice_email_sent',
                oldValues,
                newValues: {
                    email_sent: updatedInvoice.email_sent,
                    email_sent_at: updatedInvoice.email_sent_at
                },
                transaction
            });
            return updatedInvoice  ;
        });
    }

    async cancel(id, firmId, userId) {
        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status === 'paid' || invoice.status === 'cancelled') {
                const error = new Error(`A ${invoice.status} invoice cannot be cancelled`);
                error.statusCode = 409;
                throw error;
            }
            const oldStatus = invoice.status;
            await invoice.update({ status: 'cancelled' }, { transaction });
            await InvoiceAuditService.record({
                invoiceId: id,
                firmId,
                userId,
                action: 'invoice_cancelled',
                oldValues: { status: oldStatus },
                newValues: { status: invoice.status },
                transaction
            });
            return this.requireById(id, firmId, transaction);
        });
    }

    async pdf(id, firmId) {
        const invoice = await this.requireById(id, firmId);
        return { invoice, document: InvoicePdfService.generate(invoice) };
    }
}

module.exports = new InvoiceService();
