'use strict';

const express = require('express');
const ReportController = require('../controllers/ReportController');
const verifyToken = require('../middlewares/verifyToken');

const router = express.Router();

router.use(verifyToken);
router.get('/invoiced', ReportController.getTotalInvoiced);
router.get('/payments', ReportController.getTotalPayments);
router.get('/outstanding', ReportController.getTotalOutstanding);
router.get('/monthly-revenue', ReportController.getMonthlyRevenue);
router.get('/clients', ReportController.getClientBilling);
router.get('/cases', ReportController.getCaseBilling);
router.get('/unpaid-invoices', ReportController.getUnpaidInvoices);
router.get('/overdue-invoices', ReportController.getOverdueInvoices);
router.get('/tax-summary', ReportController.getTaxSummary);

module.exports = router;