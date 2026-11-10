'use strict';

const express = require('express');
const InvoiceAuditController = require('../controllers/InvoiceAuditController');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();

router.use(verifyToken);
router.get('/:id/audit-logs', InvoiceAuditController.list);

module.exports = router;
