'use strict';

const InvoiceService = require('../services/InvoiceService');
const handleError = require('../utils/handleError');

class InvoiceController {
    async create(req, res) {
        try {
            const result = await InvoiceService.create(
                req.user.firmId,
                req.user.sub,
                req.body || {},
                req.client
            );
            return res.status(201).json(result);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async list(req, res) {
        try {
            const result = await InvoiceService.list(req.user.firmId, req.query);
            return res.status(200).json(result);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async get(req, res) {
        try {
            const invoice = await InvoiceService.findById(req.params.id, req.user.firmId);
            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }
            return res.status(200).json(invoice);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async update(req, res) {
        try {
            const invoice = await InvoiceService.update(
                req.params.id,
                req.user.firmId,
                req.body || {}
            );
            if (!invoice) {
                return res.status(404).json({ message: 'Invoice not found' });
            }
            return res.status(200).json(invoice);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async issue(req, res) {
        try {
            const invoice = await InvoiceService.issue(req.params.id, req.user.firmId);
            return res.status(200).json(invoice);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async cancel(req, res) {
        try {
            const invoice = await InvoiceService.cancel(req.params.id, req.user.firmId);
            return res.status(200).json(invoice);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }

    async pdf(req, res) {
        try {
            const { invoice, document } = await InvoiceService.pdf(
                req.params.id,
                req.user.firmId
            );
            return res
                .type('application/pdf')
                .attachment(`invoice-${invoice.invoice_number}.pdf`)
                .send(document);
        } catch (error) {
            return handleError(error, res, 'invoice');
        }
    }
}

module.exports = new InvoiceController();
