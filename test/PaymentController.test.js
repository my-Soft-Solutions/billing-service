'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const loadWithMocks = require('../testSupport/loadWithMocks');

const state = { receiptResult: null, error: null };
const paymentService = {
    receipt: async (...args) => {
        state.receiptArgs = args;
        if (state.error) throw state.error;
        return state.receiptResult;
    }
};
const handleError = (error, res, resource) => {
    state.handledError = { error, resource };
    return res.status(error.statusCode || 500).json({ message: error.message });
};
const PaymentController = loadWithMocks(
    require.resolve('../controllers/PaymentController'),
    {
        '../services/PaymentService': paymentService,
        '../utils/handleError': handleError
    }
);

function makeResponse() {
    const response = {
        statusCode: null,
        contentType: null,
        attachmentName: null,
        body: null,
        type(value) {
            this.contentType = value;
            return this;
        },
        attachment(value) {
            this.attachmentName = value;
            return this;
        },
        send(value) {
            this.body = value;
            return this;
        },
        status(value) {
            this.statusCode = value;
            return this;
        },
        json(value) {
            this.body = value;
            return this;
        }
    };
    return response;
}

describe('PaymentController receipt', () => {
    it('returns a PDF attachment for the authenticated law firm', async () => {
        const document = Buffer.from('%PDF-1.4');
        state.receiptResult = {
            payment: { id: 'payment-1' },
            document
        };
        state.error = null;
        const res = makeResponse();

        await PaymentController.receipt({
            params: { id: 'payment-1' },
            user: { firmId: 'firm-1' }
        }, res);

        assert.deepEqual(state.receiptArgs, ['payment-1', 'firm-1']);
        assert.equal(res.contentType, 'application/pdf');
        assert.equal(res.attachmentName, 'payment-receipt-payment-1.pdf');
        assert.equal(res.body, document);
    });

    it('passes service errors through the standard payment error handler', async () => {
        state.error = Object.assign(new Error('Payment not found'), { statusCode: 404 });
        const res = makeResponse();

        await PaymentController.receipt({
            params: { id: 'missing' },
            user: { firmId: 'firm-1' }
        }, res);

        assert.equal(state.handledError.error, state.error);
        assert.equal(state.handledError.resource, 'payment');
        assert.equal(res.statusCode, 404);
    });
});
