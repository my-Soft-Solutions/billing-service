const express = require('express');
const app = express();
const db = require('./models');
const invoiceRoutes = require('./routes/invoiceRoutes');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1/invoices', invoiceRoutes);

module.exports = app;