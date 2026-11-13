'use strict';

const PAYMENT_METHOD_LABELS = {
    cash: 'Cash',
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque',
    card: 'Card'
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 842;
const LEFT_MARGIN = 56;
const MAX_LINE_LENGTH = 78;
const LINES_PER_PAGE = 34;

class PaymentReceiptPdfService {
    escapePdfText(value) {
        const text = String(value);
        if (/[^\x20-\x7e]/.test(text)) {
            const error = new Error('Payment receipt PDF supports ASCII text only');
            error.statusCode = 422;
            throw error;
        }
        return text;
    }

    wrapText(value) {
        let remaining = this.escapePdfText(value);
        const lines = [];

        while (remaining.length > MAX_LINE_LENGTH) {
            let breakAt = remaining.lastIndexOf(' ', MAX_LINE_LENGTH);
            if (breakAt <= 0) breakAt = MAX_LINE_LENGTH;
            lines.push(remaining.slice(0, breakAt));
            remaining = remaining.slice(breakAt).trimStart();
        }
        lines.push(remaining);
        return lines;
    }

    addText(commands, x, y, value, size = 10, font = 'F1', color = '0.16 0.20 0.25') {
        const encoded = Buffer.from(this.escapePdfText(value), 'ascii').toString('hex');
        commands.push(
            `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm <${encoded}> Tj ET`
        );
    }

    addLine(commands, x1, y1, x2, y2, color = '0.84 0.87 0.90', width = 0.7) {
        commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    }

    createPage(receiptNumber, continued = false) {
        const commands = [];
        commands.push('0.08 0.16 0.27 rg 0 740 612 102 re f');
        this.addText(
            commands,
            LEFT_MARGIN,
            794,
            continued ? 'PAYMENT RECEIPT (CONTINUED)' : 'PAYMENT RECEIPT',
            continued ? 17 : 23,
            'F2',
            '1 1 1'
        );
        this.addText(commands, LEFT_MARGIN, 770, `Receipt no. ${receiptNumber}`, 10, 'F1', '0.88 0.92 0.96');
        return commands;
    }

    addFooter(commands, receiptNumber, pageNumber, pageCount) {
        this.addLine(commands, LEFT_MARGIN, 52, PAGE_WIDTH - LEFT_MARGIN, 52);
        this.addText(commands, LEFT_MARGIN, 36, `Receipt ${receiptNumber}`, 8, 'F1', '0.45 0.49 0.54');
        this.addText(
            commands,
            468,
            36,
            `Page ${pageNumber} of ${pageCount}`,
            8,
            'F1',
            '0.45 0.49 0.54'
        );
    }

    generate(payment, invoice) {
        const receiptNumber = payment.id;
        const paymentMethod = PAYMENT_METHOD_LABELS[payment.payment_method] || payment.payment_method;
        const details = [
            ['Amount received', `${invoice.currency} ${payment.amount}`],
            ['Payment date', payment.payment_date],
            ['Payment method', paymentMethod],
            ['Status', payment.status],
            ['Received by', payment.received_by],
            ['Payment reference', payment.payment_reference || '-'],
            ['Invoice number', invoice.invoice_number],
            ['Client', invoice.client_name],
            ['Client email', invoice.client_email]
        ];
        const lines = details.flatMap(([label, value]) => this.wrapText(`${label}: ${value || '-'}`));
        const pageCount = Math.max(1, Math.ceil(lines.length / LINES_PER_PAGE));
        const pages = [];

        for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
            const commands = this.createPage(receiptNumber, pageIndex > 0);
            const pageLines = lines.slice(
                pageIndex * LINES_PER_PAGE,
                (pageIndex + 1) * LINES_PER_PAGE
            );
            let y = 708;

            for (const line of pageLines) {
                this.addText(commands, LEFT_MARGIN, y, line);
                y -= 18;
            }

            this.addFooter(commands, receiptNumber, pageIndex + 1, pageCount);
            pages.push(commands);
        }

        return this.createPdf(pages);
    }

    createPdf(pages) {
        const pageNumbers = pages.map((_, index) => 5 + index * 2);
        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            `<< /Type /Pages /Kids [${pageNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
        ];

        for (const [index, page] of pages.entries()) {
            const pageNumber = pageNumbers[index];
            const content = page.join('\n');
            objects.push(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${pageNumber + 1} 0 R >>`,
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
        for (const offset of offsets.slice(1)) {
            pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
        }
        pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
        return Buffer.from(pdf, 'ascii');
    }
}

module.exports = new PaymentReceiptPdfService();
