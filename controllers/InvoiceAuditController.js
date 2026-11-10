'use strict';

const InvoiceAuditService = require('../services/InvoiceAuditService');
const handleError = require('../utils/handleError');

class InvoiceAuditController {
    async list(req, res) {
        try {
            const result = await InvoiceAuditService.list(
                req.params.id,
                req.user.firmId,
                req.query
            );
            return res.status(200).json(result);
        } catch (error) {
            return handleError(error, res, 'invoice audit');
        }
    }
}

module.exports = new InvoiceAuditController();
