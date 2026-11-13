'use strict';

const axios = require('axios');

const emailApiClient = axios.create({
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json'
    }
});

emailApiClient.setAuthorizationHeader = function setAuthorizationHeader(authorization) {
    if (authorization) {
        this.defaults.headers.common.Authorization = authorization;
        return;
    }
    delete this.defaults.headers.common.Authorization;
};

module.exports = emailApiClient;
