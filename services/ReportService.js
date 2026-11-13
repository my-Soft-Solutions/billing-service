'use strict';

const { Invoice, Payment, Sequelize } = require('../models');
const { parsePaginationValue } = require('../utils/pagination');

const { Op, col, fn } = Sequelize;
const INVOICED_STATUSES = ['issued', 'partially_paid', 'paid', 'overdue'];
const OUTSTANDING_STATUSES = ['issued', 'partially_paid', 'overdue'];

function invoicedWhere(firmId) {
    return {
        law_firm_id: firmId,
        status: { [Op.in]: INVOICED_STATUSES }
    };
}

async function sumInvoicesByCurrency(firmId, amountField, amountAlias, extraWhere = {}) {
    return Invoice.findAll({
        attributes: [
            'currency',
            [fn('SUM', col(amountField)), amountAlias]
        ],
        where: { ...invoicedWhere(firmId), ...extraWhere },
        group: ['currency'],
        order: [['currency', 'ASC']],
        raw: true
    });
}

class ReportService {
    getTotalInvoiced(firmId) {
        return sumInvoicesByCurrency(firmId, 'total_amount', 'totalInvoiced');
    }

    getTotalPayments(firmId) {
        return Payment.findAll({
            attributes: [
                [col('invoice.currency'), 'currency'],
                [fn('SUM', col('amount')), 'totalPayments']
            ],
            where: {
                law_firm_id: firmId,
                status: 'recorded'
            },
            include: [{
                model: Invoice,
                as: 'invoice',
                attributes: [],
                required: true,
                where: { law_firm_id: firmId }
            }],
            group: [col('invoice.currency')],
            order: [[col('invoice.currency'), 'ASC']],
            raw: true
        });
    }

    getTotalOutstanding(firmId) {
        return sumInvoicesByCurrency(firmId, 'balance_due', 'totalOutstanding', {
            status: { [Op.in]: OUTSTANDING_STATUSES },
            balance_due: { [Op.gt]: 0 }
        });
    }

    getMonthlyRevenue(firmId) {
        const month = fn('DATE_FORMAT', col('payment_date'), '%Y-%m');
        return Payment.findAll({
            attributes: [
                [month, 'month'],
                [col('invoice.currency'), 'currency'],
                [fn('SUM', col('amount')), 'revenue']
            ],
            where: {
                law_firm_id: firmId,
                status: 'recorded'
            },
            include: [{
                model: Invoice,
                as: 'invoice',
                attributes: [],
                required: true,
                where: { law_firm_id: firmId }
            }],
            group: [month, col('invoice.currency')],
            order: [[month, 'ASC'], [col('invoice.currency'), 'ASC']],
            raw: true
        });
    }

    getClientBilling(firmId) {
        return Invoice.findAll({
            attributes: [
                'client_id',
                'client_name',
                'currency',
                [fn('SUM', col('total_amount')), 'totalInvoiced'],
                [fn('SUM', col('balance_due')), 'totalOutstanding']
            ],
            where: invoicedWhere(firmId),
            group: ['client_id', 'client_name', 'currency'],
            order: [['client_name', 'ASC'], ['currency', 'ASC']],
            raw: true
        });
    }

    getCaseBilling(firmId) {
        return Invoice.findAll({
            attributes: [
                'case_id',
                'currency',
                [fn('SUM', col('total_amount')), 'totalInvoiced'],
                [fn('SUM', col('balance_due')), 'totalOutstanding']
            ],
            where: {
                ...invoicedWhere(firmId),
                case_id: { [Op.ne]: null }
            },
            group: ['case_id', 'currency'],
            order: [['case_id', 'ASC'], ['currency', 'ASC']],
            raw: true
        });
    }

    async getUnpaidInvoices(firmId, filters = {}) {
        const page = parsePaginationValue(filters.page, 1, 'page');
        const limit = parsePaginationValue(filters.limit, 20, 'limit', 100);
        const result = await Invoice.findAndCountAll({
            attributes: [
                'id', 'invoice_number', 'client_id', 'client_name', 'case_id',
                'issue_date', 'due_date', 'currency', 'total_amount',
                'paid_amount', 'balance_due', 'status'
            ],
            where: {
                law_firm_id: firmId,
                status: { [Op.in]: ['issued', 'partially_paid'] },
                balance_due: { [Op.gt]: 0 }
            },
            order: [['due_date', 'ASC'], ['invoice_number', 'ASC']],
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

    async getOverdueInvoices(firmId, filters = {}) {
        const page = parsePaginationValue(filters.page, 1, 'page');
        const limit = parsePaginationValue(filters.limit, 20, 'limit', 100);
        const result = await Invoice.findAndCountAll({
            attributes: [
                'id', 'invoice_number', 'client_id', 'client_name', 'case_id',
                'issue_date', 'due_date', 'currency', 'total_amount',
                'paid_amount', 'balance_due', 'status'
            ],
            where: {
                law_firm_id: firmId,
                status: 'overdue',
                balance_due: { [Op.gt]: 0 }
            },
            order: [['due_date', 'ASC'], ['invoice_number', 'ASC']],
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

    getTaxSummary(firmId) {
        return Invoice.findAll({
            attributes: [
                'currency',
                [fn('SUM', col('subtotal')), 'subtotal'],
                [fn('SUM', col('discount_amount')), 'discountAmount'],
                [fn('SUM', col('tax_amount')), 'taxAmount'],
                [fn('SUM', col('total_amount')), 'totalInvoiced']
            ],
            where: invoicedWhere(firmId),
            group: ['currency'],
            order: [['currency', 'ASC']],
            raw: true
        });
    }
}

module.exports = new ReportService();