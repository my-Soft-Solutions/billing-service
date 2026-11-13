'use strict';

const express = require('express');
const PaymentController = require('../controllers/PaymentController');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();

router.use(verifyToken);
router.post('/', PaymentController.create);
router.get('/', PaymentController.list);
router.get('/:id/receipt', PaymentController.receipt);
router.get('/:id', PaymentController.get);
router.patch('/:id/void', PaymentController.void);

module.exports = router;
