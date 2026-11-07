'use strict';

const BillingSettingsService = require('../services/BillingSettingsService');
const handleError = require('../utils/handleError');

class BillingSettingsController {
    async get(req, res) {
        try {
            const settings = await BillingSettingsService.get(req.user.firmId);
            if (!settings) {
                return res.status(404).json({ message: 'Billing settings not found' });
            }
            return res.status(200).json(settings);
        } catch (error) {
            return handleError(error, res, 'billing settings');
        }
    }

    async create(req, res) {
        try {
            const settings = await BillingSettingsService.create(
                req.user.firmId,
                req.body || {}
            );
            return res.status(201).json(settings);
        } catch (error) {
            return handleError(error, res, 'billing settings');
        }
    }

    async update(req, res) {
        try {
            const settings = await BillingSettingsService.update(
                req.user.firmId,
                req.body || {}
            );
            return res.status(200).json(settings);
        } catch (error) {
            return handleError(error, res, 'billing settings');
        }
    }
}

module.exports = new BillingSettingsController();
