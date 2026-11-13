'use strict';

const PaymentService = require('../services/PaymentService');
const handleError = require('../utils/handleError');

class PaymentController {
    async create(req, res) {
        try {
            const payment = await PaymentService.create(
                req.user.firmId,
                req.user.sub,
                req.body || {}
            );
            return res.status(201).json(payment);
        } catch (error) {
            return handleError(error, res, 'payment');
        }
    }

    async list(req, res) {
        try {
            const result = await PaymentService.list(req.user.firmId, req.query);
            return res.status(200).json(result);
        } catch (error) {
            return handleError(error, res, 'payment');
        }
    }

    async get(req, res) {
        try {
            const payment = await PaymentService.findById(req.params.id, req.user.firmId);
            if (!payment) {
                return res.status(404).json({ message: 'Payment not found' });
            }
            return res.status(200).json(payment);
        } catch (error) {
            return handleError(error, res, 'payment');
        }
    }

    async receipt(req, res) {
        try {
            const { payment, document } = await PaymentService.receipt(
                req.params.id,
                req.user.firmId
            );
            return res
                .type('application/pdf')
                .attachment(`payment-receipt-${payment.id}.pdf`)
                .send(document);
        } catch (error) {
            return handleError(error, res, 'payment');
        }
    }

    async void(req, res) {
        try {
            const payment = await PaymentService.void(
                req.params.id,
                req.user.firmId,
                req.user.sub
            );
            return res.status(200).json(payment);
        } catch (error) {
            return handleError(error, res, 'payment');
        }
    }
}

module.exports = new PaymentController();
