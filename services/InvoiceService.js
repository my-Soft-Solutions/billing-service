'use strict';

const { randomUUID } = require('crypto');
const { Invoice, InvoiceItem, sequelize } = require('../models');
const InvoiceItemService = require('./InvoiceItemService');
const InvoiceCalculationService = require('./InvoiceCalculationService');
const InvoiceNumberService = require('./InvoiceNumberService');
const InvoicePdfService = require('./InvoicePdfService');
const { parsePaginationValue, getStringFilter, validationError } = require('../utils/pagination');
const filterAllowedFields = require('../utils/filterAllowedFields');
const validateDate = require('../utils/dateValidator');
const { INVOICE_FIELDS } = require('../utils/allowedFields');

const INVOICE_STATUSES = ['draft', 'issued', 'partially_paid', 'paid', 'overdue', 'cancelled'];

function requiredString(value, field) {
    if (typeof value !== 'string' || value.trim() === '') {
        throw validationError(`${field} is required`);
    }
    return value.trim();
} 

class InvoiceService {
    async findById(id, firmId, transaction) {
        return Invoice.findOne({
            where: { id, law_firm_id: firmId },
            include: [{ model: InvoiceItem, as: 'items' }],
            transaction
        });
    }

    async requireById(id, firmId, transaction) {
        const invoice = await this.findById(id, firmId, transaction);
        if (!invoice) {
            const error = new Error('Invoice not found');
            error.statusCode = 404;
            throw error;
        }
        return invoice;
    }

    async create(firmId, userId, data, client) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw validationError('Request body must be a JSON object');
        }
        data = filterAllowedFields(data, INVOICE_FIELDS);
        const clientId = requiredString(data.client_id, 'client_id');
        const currency = requiredString(data.currency, 'currency').toUpperCase();
        if (!/^[A-Z]{3}$/.test(currency)) throw validationError('currency must be a three-letter code');
        if (data.case_id != null && typeof data.case_id !== 'string') {
            throw validationError('case_id must be a string or null');
        }
        if (data.notes != null && typeof data.notes !== 'string') {
            throw validationError('notes must be a string or null');
        }

        const items = InvoiceItemService.prepareItems(data.items === undefined ? [] : data.items);
        const totals = InvoiceCalculationService.calculateTotals(
            items,
            data.discount_amount ?? '0',
            data.tax_amount ?? '0'
        );
        const id = randomUUID();

        return sequelize.transaction(async transaction => {
            const invoiceNumber = await InvoiceNumberService.generate(firmId, transaction);
            await InvoiceNumberService.assertUnique(firmId, invoiceNumber, transaction);
            await Invoice.create({
                id,
                law_firm_id: firmId,
                client_id: clientId,
                client_name: client.name,
                client_email: client.email,
                client_phone: client.phone,
                case_id: data.case_id || null,
                invoice_number: invoiceNumber,
                issue_date: validateDate(data.issue_date, 'issue_date'),
                due_date: validateDate(data.due_date, 'due_date'),
                currency,
                ...totals,
                status: 'draft',
                notes: data.notes ?? null,
                created_by: userId
            }, { transaction });

            await InvoiceItemService.createForInvoice(id, items, transaction);
            return this.requireById(id, firmId, transaction);
        });
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

    async update(id, firmId, data) {
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw validationError('Request body must be a JSON object');
        }
        data = filterAllowedFields(data, INVOICE_FIELDS);

        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status !== 'draft') {
                const error = new Error('Only draft invoices can be updated');
                error.statusCode = 409;
                throw error;
            }
            const invoiceNumber = data.invoice_number === undefined
                ? invoice.invoice_number
                : data.invoice_number;
            const validatedInvoiceNumber = InvoiceNumberService.validate(invoiceNumber);
            await InvoiceNumberService.assertUnique(firmId, validatedInvoiceNumber, transaction, id);

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
            const changes = { ...totals, invoice_number: validatedInvoiceNumber };

            if (data.client_id !== undefined) changes.client_id = requiredString(data.client_id, 'client_id');
            if (data.case_id !== undefined) {
                if (data.case_id !== null && typeof data.case_id !== 'string') {
                    throw validationError('case_id must be a string or null');
                }
                changes.case_id = data.case_id;
            }
            if (data.issue_date !== undefined) changes.issue_date = validateDate(data.issue_date, 'issue_date');
            if (data.due_date !== undefined) changes.due_date = validateDate(data.due_date, 'due_date');
            if (data.currency !== undefined) {
                changes.currency = requiredString(data.currency, 'currency').toUpperCase();
                if (!/^[A-Z]{3}$/.test(changes.currency)) {
                    throw validationError('currency must be a three-letter code');
                }
            }
            if (data.notes !== undefined) {
                if (data.notes !== null && typeof data.notes !== 'string') {
                    throw validationError('notes must be a string or null');
                }
                changes.notes = data.notes;
            }
            await invoice.update(changes, { transaction });

            if (data.items !== undefined) {
                await InvoiceItemService.replaceForInvoice(id, items, transaction);
            }
            return this.requireById(id, firmId, transaction);
        });
    }

    async issue(id, firmId) {
        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status !== 'draft') {
                const error = new Error('Only draft invoices can be issued');
                error.statusCode = 409;
                throw error;
            }
            if (!invoice.items.length) throw validationError('Add at least one item before issuing an invoice');
            await invoice.update({
                status: 'issued',
                issue_date: invoice.issue_date || new Date().toISOString().slice(0, 10)
            }, { transaction });
            return this.requireById(id, firmId, transaction);
        });
    }

    async cancel(id, firmId) {
        return sequelize.transaction(async transaction => {
            const invoice = await this.requireById(id, firmId, transaction);
            if (invoice.status === 'paid' || invoice.status === 'cancelled') {
                const error = new Error(`A ${invoice.status} invoice cannot be cancelled`);
                error.statusCode = 409;
                throw error;
            }
            await invoice.update({ status: 'cancelled' }, { transaction });
            return this.requireById(id, firmId, transaction);
        });
    }

    async pdf(id, firmId) {
        const invoice = await this.requireById(id, firmId);
        return { invoice, document: InvoicePdfService.generate(invoice) };
    }
}

module.exports = new InvoiceService();
