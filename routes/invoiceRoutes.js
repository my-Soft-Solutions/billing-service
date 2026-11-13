'use strict';

const express = require('express');
const InvoiceController = require('../controllers/InvoiceController');
const verifyToken = require('../middlewares/verifyToken');
const verifyClient = require('../middlewares/verifyClient');

const router = express.Router();

router.use(verifyToken);
router.post('/', verifyClient({ required: true }), InvoiceController.create);
router.get('/', InvoiceController.list);
router.get('/:id/pdf', InvoiceController.pdf);
router.get('/:id', InvoiceController.get);
router.put('/:id', verifyClient(), InvoiceController.update);
router.patch('/:id/issue', InvoiceController.issue);
router.post('/:id/send-email', InvoiceController.sendEmail);
router.patch('/:id/cancel', InvoiceController.cancel);

module.exports = router;
