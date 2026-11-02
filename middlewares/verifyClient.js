'use strict';

const axios = require('axios');

function sendError(res, status, message) {
    return res.status(status).json({ message });
}

function verifyClient(options = {}) {
    return async (req, res, next) => {
        const clientId = req.body && req.body.client_id;
        if (clientId === undefined || clientId === null || clientId === '') {
            if (options.required) {
                return sendError(res, 400, 'client_id is required');
            }
            return next();
        }
        if (typeof clientId !== 'string') {
            return sendError(res, 400, 'client_id must be a string');
        }

        const baseUrl = process.env.MAIN_API_URL;
        if (!baseUrl) {
            console.error('MAIN_API_URL is not configured');
            return sendError(res, 503, 'Client verification service is not configured');
        }

        const authorization = req.headers.authorization;
        if (!authorization) {
            return sendError(res, 401, 'Authentication token required for client verification');
        }

        try {
            const apiUrl = `${baseUrl.replace(/\/+$/, '')}/clients/${encodeURIComponent(clientId)}`;
            const response = await axios.get(apiUrl, {
                headers: { Authorization: authorization },
                timeout: 5000
            });
            const client = response.data;

            if (!client || client.id !== clientId || client.law_firm_id !== req.user.firmId) {
                return sendError(res, 404, 'Client not found in this law firm');
            }

            req.client = client;
            return next();
        } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
                if (error.response.status === 404) {
                    return sendError(res, 404, 'Client not found in this law firm');
                }
                if (error.response.status === 401 || error.response.status === 403) {
                    return sendError(res, error.response.status, 'Client verification was not authorized');
                }
            }

            console.error('Client verification request failed:', error.message);
            return sendError(res, 502, 'Unable to verify client with the main API');
        }
    };
}

module.exports = verifyClient;