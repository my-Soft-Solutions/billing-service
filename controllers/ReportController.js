'use strict';

const ReportService = require('../services/ReportService');
const handleError = require('../utils/handleError');

async function sendReport(req, res, query) {
    try {
        const result = await query(req.user.firmId, req.query);
        return res.status(200).json(result);
    } catch (error) {
        return handleError(error, res, 'report');
    }
}

class ReportController {
    async getTotalInvoiced(req, res) {
        return sendReport(req, res, firmId => ReportService.getTotalInvoiced(firmId));
    }

    async getTotalPayments(req, res) {
        return sendReport(req, res, firmId => ReportService.getTotalPayments(firmId));
    }

    async getTotalOutstanding(req, res) {
        return sendReport(req, res, firmId => ReportService.getTotalOutstanding(firmId));
    }

    async getMonthlyRevenue(req, res) {
        return sendReport(req, res, firmId => ReportService.getMonthlyRevenue(firmId));
    }

    async getClientBilling(req, res) {
        return sendReport(req, res, firmId => ReportService.getClientBilling(firmId));
    }

    async getCaseBilling(req, res) {
        return sendReport(req, res, firmId => ReportService.getCaseBilling(firmId));
    }

    async getUnpaidInvoices(req, res) {
        return sendReport(req, res, (firmId, filters) =>
            ReportService.getUnpaidInvoices(firmId, filters)
        );
    }

    async getOverdueInvoices(req, res) {
        return sendReport(req, res, (firmId, filters) =>
            ReportService.getOverdueInvoices(firmId, filters)
        );
    }

    async getTaxSummary(req, res) {
        return sendReport(req, res, firmId => ReportService.getTaxSummary(firmId));
    }
}

module.exports = new ReportController();