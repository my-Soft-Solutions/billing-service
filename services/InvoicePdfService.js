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

    text(commands, x, y, value, size = 10, font = 'F1', color = '0.16 0.20 0.25') {
        const encoded = Buffer
            .from(this.escapePdfText(value), 'ascii')
            .toString('hex');
        commands.push(
            `BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${y} Tm <${encoded}> Tj ET`
        );
    }

    rectangle(commands, x, y, width, height, color) {
        commands.push(`${color} rg ${x} ${y} ${width} ${height} re f`);
    }

    line(commands, x1, y1, x2, y2, color = '0.84 0.87 0.90', width = 0.7) {
        commands.push(`${color} RG ${width} w ${x1} ${y1} m ${x2} ${y2} l S`);
    }

    wrapText(value, maxLength) {
        const text = this.escapePdfText(value).replace(/\s+/g, ' ').trim();
        if (!text) return ['-'];

        const lines = [];
        let line = '';
        for (const word of text.split(' ')) {
            let remaining = word;
            while (remaining.length > maxLength) {
                if (line) {
                    lines.push(line);
                    line = '';
                }
                lines.push(remaining.slice(0, maxLength));
                remaining = remaining.slice(maxLength);
            }
            if (line && `${line} ${remaining}`.length > maxLength) {
                lines.push(line);
                line = remaining;
            } else {
                line = line ? `${line} ${remaining}` : remaining;
            }
        }
        if (line) lines.push(line);
        return lines;
    }

    createContinuationPage(invoice, title, withTable = false) {
        const commands = [];
        this.rectangle(commands, 0, 772, 612, 70, '0.08 0.16 0.27');
        this.text(commands, 48, 804, title, 17, 'F2', '1 1 1');
        this.text(
            commands,
            365,
            804,
            `Invoice ${invoice.invoice_number}`,
            9,
            'F1',
            '0.88 0.92 0.96'
        );

        let y = 750;
        if (withTable) {
            this.drawTableHeader(commands, y);
            y -= 18;
        }
        return { commands, y };
    }

    drawTableHeader(commands, y) {
        this.rectangle(commands, 48, y - 8, 516, 25, '0.89 0.92 0.95');
        this.text(commands, 56, y, 'Description', 8, 'F2', '0.24 0.31 0.39');
        this.text(commands, 292, y, 'Type', 8, 'F2', '0.24 0.31 0.39');
        this.text(commands, 366, y, 'Qty', 8, 'F2', '0.24 0.31 0.39');
        this.text(commands, 414, y, 'Unit price', 8, 'F2', '0.24 0.31 0.39');
        this.text(commands, 504, y, 'Amount', 8, 'F2', '0.24 0.31 0.39');
    }

    addFooter(commands, invoice, pageNumber, pageCount) {
        this.line(commands, 48, 52, 564, 52);
        this.text(commands, 48, 36, `Invoice ${invoice.invoice_number}`, 8, 'F1', '0.45 0.49 0.54');
        this.text(
            commands,
            495,
            36,
            `Page ${pageNumber} of ${pageCount}`,
            8,
            'F1',
            '0.45 0.49 0.54'
        );
    }

    generate(invoice) {
        const pages = [];
        const commands = [];
        pages.push(commands);

        this.rectangle(commands, 0, 740, 612, 102, '0.08 0.16 0.27');
        this.rectangle(commands, 0, 736, 612, 4, '0.16 0.62 0.62');
        this.text(commands, 48, 800, 'INVOICE', 25, 'F2', '1 1 1');
        this.text(
            commands,
            48,
            777,
            `Invoice no. ${invoice.invoice_number}`,
            10,
            'F1',
            '0.88 0.92 0.96'
        );
        this.text(commands, 424, 800, 'STATUS', 8, 'F2', '0.72 0.81 0.88');
        this.text(
            commands,
            424,
            782,
            String(invoice.status).toUpperCase().replace(/_/g, ' '),
            10,
            'F2',
            '1 1 1'
        );

        const clientFields = [
            ['Name', invoice.client_name],
            ['Email', invoice.client_email],
            ['Phone', invoice.client_phone]
        ].flatMap(([label, value]) =>
            this.wrapText(`${label}: ${value || '-'}`, 45)
        );
        const clientCardBottom = Math.min(620, 680 - clientFields.length * 12 - 12);
        this.rectangle(commands, 48, clientCardBottom, 298, 722 - clientCardBottom, '0.96 0.97 0.98');
        this.rectangle(commands, 360, clientCardBottom, 204, 722 - clientCardBottom, '0.96 0.97 0.98');
        this.text(commands, 58, 704, 'BILL TO', 8, 'F2', '0.16 0.45 0.55');
        this.text(commands, 370, 704, 'INVOICE DETAILS', 8, 'F2', '0.16 0.45 0.55');

        let clientY = 684;
        for (const field of clientFields) {
            this.text(commands, 58, clientY, field, 9, 'F1');
            clientY -= 12;
        }

        const currency = invoice.currency;
        const details = [
            ['Issue date', invoice.issue_date || '-'],
            ['Due date', invoice.due_date || '-'],
            ['Currency', currency],
            ['Balance due', `${currency} ${invoice.balance_due}`]
        ];
        let detailsY = 684;
        for (const [label, value] of details) {
            this.text(commands, 370, detailsY, label, 8, 'F1', '0.45 0.49 0.54');
            this.text(
                commands,
                430,
                detailsY,
                String(value),
                label === 'Balance due' ? 9 : 8,
                label === 'Balance due' ? 'F2' : 'F1'
            );
            detailsY -= 17;
        }

        const itemsTitleY = clientCardBottom - 34;
        this.text(commands, 48, itemsTitleY, 'ITEMS', 11, 'F2', '0.08 0.16 0.27');
        const tableHeaderY = itemsTitleY - 24;
        this.drawTableHeader(commands, tableHeaderY);
        let rowY = tableHeaderY - 18;

        for (const [index, item] of invoice.items.entries()) {
            const descriptionLines = this.wrapText(item.description, 42);
            const rowHeight = Math.max(30, descriptionLines.length * 12 + 10);
            if (rowY - rowHeight < 80) {
                const nextPage = this.createContinuationPage(invoice, 'ITEMS (CONTINUED)', true);
                pages.push(nextPage.commands);
                rowY = nextPage.y;
            }

            const rowBottom = rowY - rowHeight;
            if (index % 2 === 0) {
                this.rectangle(commandsForPage(pages), 48, rowBottom, 516, rowHeight, '0.98 0.985 0.99');
            }
            const rowCommands = commandsForPage(pages);
            descriptionLines.forEach((line, lineIndex) => {
                this.text(rowCommands, 56, rowY - 13 - lineIndex * 12, line, 8.5);
            });
            this.text(rowCommands, 292, rowY - 13, String(item.billing_type), 8, 'F1');
            this.text(rowCommands, 366, rowY - 13, String(item.quantity), 8, 'F1');
            this.text(rowCommands, 414, rowY - 13, String(item.unit_price), 8, 'F1');
            this.text(rowCommands, 504, rowY - 13, String(item.amount), 8, 'F1');
            this.line(rowCommands, 48, rowBottom, 564, rowBottom);
            rowY = rowBottom;
        }

        let currentCommands = commandsForPage(pages);
        if (rowY < 280) {
            const nextPage = this.createContinuationPage(invoice, 'INVOICE SUMMARY');
            pages.push(nextPage.commands);
            currentCommands = nextPage.commands;
            rowY = nextPage.y;
        }

        let summaryY = rowY - 18;
        this.line(currentCommands, 48, summaryY + 8, 564, summaryY + 8);
        const totals = [
            ['Subtotal', `${currency} ${invoice.subtotal}`],
            ['Discount', `- ${currency} ${invoice.discount_amount}`],
            [
                `Tax${invoice.tax_rate === null || invoice.tax_rate === undefined ? '' : ` (${invoice.tax_rate}%)`}`,
                `${currency} ${invoice.tax_amount}`
            ],
            ['Total', `${currency} ${invoice.total_amount}`],
            ['Paid to date', `${currency} ${invoice.paid_amount}`]
        ];

        for (const [label, value] of totals) {
            summaryY -= 19;
            const isTotal = label === 'Total';
            this.text(
                currentCommands,
                350,
                summaryY,
                label,
                isTotal ? 11 : 9,
                isTotal ? 'F2' : 'F1',
                isTotal ? '0.08 0.16 0.27' : '0.31 0.35 0.40'
            );
            this.text(
                currentCommands,
                448,
                summaryY,
                value,
                isTotal ? 11 : 9,
                isTotal ? 'F2' : 'F1',
                isTotal ? '0.08 0.16 0.27' : '0.31 0.35 0.40'
            );
        }

        summaryY -= 22;
        this.rectangle(currentCommands, 340, summaryY - 10, 224, 29, '0.89 0.95 0.95');
        this.text(currentCommands, 350, summaryY, 'BALANCE DUE', 9, 'F2', '0.08 0.35 0.40');
        this.text(
            currentCommands,
            448,
            summaryY,
            `${currency} ${invoice.balance_due}`,
            11,
            'F2',
            '0.08 0.35 0.40'
        );
        let contentY = summaryY - 34;

        const addSection = (title, value) => {
            if (!value) return;
            const lines = this.wrapText(value, 96);
            if (contentY < 100) {
                const nextPage = this.createContinuationPage(invoice, 'INVOICE DETAILS (CONTINUED)');
                pages.push(nextPage.commands);
                currentCommands = nextPage.commands;
                contentY = nextPage.y;
            }
            contentY -= 4;
            this.text(currentCommands, 48, contentY, title.toUpperCase(), 8, 'F2', '0.16 0.45 0.55');
            contentY -= 15;
            for (const line of lines) {
                if (contentY < 70) {
                    const nextPage = this.createContinuationPage(invoice, 'INVOICE DETAILS (CONTINUED)');
                    pages.push(nextPage.commands);
                    currentCommands = nextPage.commands;
                    contentY = nextPage.y;
                }
                this.text(currentCommands, 48, contentY, line, 9, 'F1');
                contentY -= 13;
            }
            contentY -= 7;
        };

        addSection('Notes', invoice.notes);
        addSection('Payment instructions', invoice.payment_instructions);
        addSection('Additional information', invoice.invoice_footer);

        pages.forEach((page, index) => {
            this.addFooter(page, invoice, index + 1, pages.length);
        });

        const pageNumbers = pages.map((_, index) => 5 + index * 2);
        const objects = [
            '<< /Type /Catalog /Pages 2 0 R >>',
            `<< /Type /Pages /Kids [${pageNumbers.map(number => `${number} 0 R`).join(' ')}] /Count ${pages.length} >>`,
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
        ];
        for (const [index, page] of pages.entries()) {
            const pageNumber = pageNumbers[index];
            const contentNumber = pageNumber + 1;
            const content = page.join('\n');
            objects.push(
                `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`,
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

function commandsForPage(pages) {
    return pages[pages.length - 1];
}

module.exports = new InvoicePdfService();
