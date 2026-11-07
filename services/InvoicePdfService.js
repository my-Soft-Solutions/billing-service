'use strict';

class InvoicePdfService {
    escapePdfText(value) {
        const text = String(value);
        if (/[^\x20-\x7e]/.test(text)) {
            const error = new Error('PDF export currently supports ASCII text only');
            error.statusCode = 422;
            throw error;
        }
        return text;
    }

    generate(invoice) {
        const lines = [
            `Invoice ${invoice.invoice_number}`,
            `Status: ${invoice.status}    Currency: ${invoice.currency}`,
            `Client: ${invoice.client_id}`,
            `Issue date: ${invoice.issue_date || '-'}    Due date: ${invoice.due_date || '-'}`,
            '',
            'Description                         Type     Qty      Unit price       Amount',
            ...invoice.items.map(item =>
                `${item.description.slice(0, 30).padEnd(30)}  ${item.billing_type.padEnd(7)}  ${String(item.quantity).padStart(6)}  ${String(item.unit_price).padStart(12)}  ${String(item.amount).padStart(12)}`
            ),
            '',
            `Subtotal: ${invoice.subtotal}`,
            `Discount: ${invoice.discount_amount}`,
            `Tax${invoice.tax_rate === null ? '' : ` (${invoice.tax_rate}%)`}: ${invoice.tax_amount}`,
            `Total: ${invoice.total_amount}`,
            `Paid: ${invoice.paid_amount}    Balance due: ${invoice.balance_due}`,
            ...(invoice.notes ? ['', `Notes: ${invoice.notes}`] : []),
            ...(invoice.payment_instructions ? ['', `Payment instructions: ${invoice.payment_instructions}`] : []),
            ...(invoice.invoice_footer ? ['', invoice.invoice_footer] : [])
        ];
        const pages = [];
        for (let index = 0; index < lines.length; index += 48) pages.push(lines.slice(index, index + 48));

        const pageNumbers = pages.map((_, index) => 4 + index * 2);
        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            `<< /Type /Pages /Kids [${pageNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
        ];
        for (const [index, page] of pages.entries()) {
            const pageNumber = pageNumbers[index];
            const contentNumber = pageNumber + 1;
            const content = [
                'BT',
                '/F1 10 Tf',
                '50 790 Td',
                ...page.flatMap((line, lineIndex) => [
                    lineIndex === 0 ? '' : '0 -15 Td',
                    `<${Buffer.from(this.escapePdfText(line), 'ascii').toString('hex')}> Tj`
                ]).filter(Boolean),
                'ET'
            ].join('\n');
            objects.push(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentNumber} 0 R >>`,
                `<< /Length ${Buffer.byteLength(content, 'ascii')} >>\nstream\n${content}\nendstream`
            );
        }
        let pdf = '%PDF-1.4\n';
        const offsets = [0];
        for (const [index, object] of objects.entries()) {
            offsets.push(Buffer.byteLength(pdf, 'ascii'));
            pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
        }
        const xrefOffset = Buffer.byteLength(pdf, 'ascii');
        pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
        for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return Buffer.from(pdf, 'ascii');
    }
}

module.exports = new InvoicePdfService();
