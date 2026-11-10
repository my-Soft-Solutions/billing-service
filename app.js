const express = require('express');
const app = express();
const db = require('./models');
const invoiceRoutes = require('./routes/invoiceRoutes');
const invoiceAuditRoutes = require('./routes/invoiceAuditRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const billingSettingsRoutes = require('./routes/billingSettingsRoutes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/audit-logs', invoiceAuditRoutes);
app.use('/api/v1/payments', paymentRoutes);
app.use('/api/v1/billing-settings', billingSettingsRoutes);

module.exports = app;