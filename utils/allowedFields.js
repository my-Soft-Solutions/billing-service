

'use strict';

const INVOICE_FIELDS = [
    'invoice_number',
    'client_id',
    'case_id',
    'issue_date',
    'due_date',
    'currency',
    'discount_amount',
    'tax_amount',
    'notes',
    'items'
];

const INVOICE_ITEM_FIELDS = [
    'description',
    'billing_type',
    'quantity',
    'unit_price'
];

module.exports = {
    INVOICE_FIELDS,
    INVOICE_ITEM_FIELDS
};
