const app = require('./app');
const overdueInvoiceJob = require('./jobs/OverdueInvoiceJob');
const PORT = process.env.PORT || 3000;

overdueInvoiceJob.start();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});