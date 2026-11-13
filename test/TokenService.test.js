'use strict';

const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const TokenService = require('../services/TokenService');

const environment = {
    JWT_SECRET: process.env.JWT_SECRET,
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
    JWT_ISSUER: process.env.JWT_ISSUER,
    JWT_AUDIENCE: process.env.JWT_AUDIENCE
};

before(() => {
    process.env.JWT_SECRET = 'unit-test-secret';
    process.env.JWT_EXPIRES_IN = '1h';
    process.env.JWT_ISSUER = 'billing-service-tests';
    process.env.JWT_AUDIENCE = 'billing-service-test-clients';
});

after(() => {
    for (const [key, value] of Object.entries(environment)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    }
});

describe('TokenService', () => {
    it('generates and verifies tokens with the expected user claims', () => {
        const user = {
            id: 'user-1',
            email: 'user@example.com',
            role: 'billing',
            law_firm_id: 'firm-1'
        };
        const decoded = TokenService.verifyToken(TokenService.generate(user));

        assert.equal(decoded.sub, user.id);
        assert.equal(decoded.email, user.email);
        assert.equal(decoded.role, user.role);
        assert.equal(decoded.firmId, user.law_firm_id);
        assert.equal(decoded.iss, process.env.JWT_ISSUER);
        assert.equal(decoded.aud, process.env.JWT_AUDIENCE);
    });

    it('compares token identity and firm and returns false for invalid tokens', () => {
        const user = { id: 'user-1', law_firm_id: 'firm-1' };
        const token = TokenService.generate({
            ...user,
            email: 'user@example.com',
            role: 'billing'
        });

        assert.equal(TokenService.compare(token, user), true);
        assert.equal(TokenService.compare(token, { ...user, law_firm_id: 'firm-2' }), false);
        assert.equal(TokenService.compare('invalid-token', user), false);
    });
});
