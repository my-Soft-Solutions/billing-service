const express = require('express');
const app = express();
const db = require('./models');
const invoiceRoutes = require('./routes/invoiceRoutes');
const paymentRoutes = require('./routes/paymentRoutes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/invoices', invoiceRoutes);
app.use('/api/v1/payments', paymentRoutes);

module.exports = app;