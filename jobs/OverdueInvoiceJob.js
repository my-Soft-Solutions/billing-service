'use strict';

const cron = require('node-cron');
const OverdueInvoiceService = require('../services/OverdueInvoiceService');

const TIME_ZONE = 'Asia/Colombo';
const SCHEDULE = '0 6 * * *';

function getCurrentDateInTimeZone(timeZone) {
    const dateParts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());
    const parts = Object.fromEntries(dateParts.map(part => [part.type, part.value]));

    return `${parts.year}-${parts.month}-${parts.day}`;
}

function start() {
    return cron.schedule(SCHEDULE, async () => {
        try {
            const updatedCount = await OverdueInvoiceService.markOverdue(
                getCurrentDateInTimeZone(TIME_ZONE)
            );
            console.info(`Marked ${updatedCount} invoice(s) as overdue`);
        } catch (error) {
            console.error('Failed to mark overdue invoices', error);
        }
    }, { timezone: TIME_ZONE });
}

module.exports = { start };
