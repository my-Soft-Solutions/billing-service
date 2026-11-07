'use strict';

const { randomUUID } = require('crypto');
const { InvoiceSetting } = require('../models');
const validateBillingSettings = require('../utils/validateBillingSettings');

class BillingSettingsService {
    async get(firmId) {
        return InvoiceSetting.findOne({ where: { law_firm_id: firmId } });
    }

    async create(firmId, data) {
        const settings = validateBillingSettings(data);
        const existing = await this.get(firmId);
        if (existing) {
            const error = new Error('Billing settings already exist for this law firm');
            error.statusCode = 409;
            throw error;
        }

        try {
            return await InvoiceSetting.create({
                id: randomUUID(),
                law_firm_id: firmId,
                ...settings
            });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                const conflict = new Error('Billing settings already exist for this law firm');
                conflict.statusCode = 409;
                throw conflict;
            }
            throw error;
        }
    }

    async update(firmId, data) {
        const changes = validateBillingSettings(data, true);
        const settings = await this.get(firmId);
        if (!settings) {
            const error = new Error('Billing settings not found');
            error.statusCode = 404;
            throw error;
        }
        await settings.update(changes);
        return settings;
    }
}

module.exports = new BillingSettingsService();
