/**
 * Contracts Utility Library
 * Handles placeholder replacement and PDF generation logic
 */

/**
 * Replaces {{TAGS}} in content with values from data object
 * @param content The HTML/Text content with placeholders
 * @param data Object containing key-value pairs for placeholders
 */
export function replacePlaceholders(content: string, data: Record<string, any>): string {
    let result = content;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        result = result.replace(regex, value?.toString() || '');
    }
    return result;
}

/**
 * Extracts all {{TAGS}} found in a string
 */
export function extractPlaceholders(content: string): string[] {
    const regex = /{{(.*?)}}/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches.map(m => m.replace(/{{|}}/g, '')))];
}

export const INVOICE_START_NUMBER = 20000;
export const INVOICE_SERIES = 'F';
export const INVOICE_VAT_RATE = 0.21;
export const INVOICE_FIXED_CONCEPT = 'Prestacion de servicios audiovisuales.';

export const INVOICE_COMPANY = {
    name: 'LAESE PRODUCCIONES S.L.',
    cif: 'B72757990',
    address: 'c/ Nuestra Señora de Valme 23, 41701, Dos Hermanas',
    iban: 'ES84 0182 3135 2202 0161 7430',
};

export const INVOICE_CLIENT_FIELDS = [
    { key: 'CLIENTE_NOMBRE_FISCAL', label: 'Nombre empresa / razón social / nombre completo' },
    { key: 'CLIENTE_CIF', label: 'NIF / DNI / CIF' },
    { key: 'CLIENTE_DIRECCION', label: 'Dirección fiscal' },
];

export function getInvoiceClientFieldKeys() {
    return INVOICE_CLIENT_FIELDS.map((field) => field.key);
}

export function formatInvoiceNumber(invoiceNumber: number) {
    return `${INVOICE_SERIES}-${invoiceNumber}`;
}

export async function getNextInvoiceNumber(supabase: any) {
    const contractQuery = supabase
        .from('contracts')
        .select('invoice_number')
        .not('invoice_number', 'is', null)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    const manualQuery = supabase
        .from('manual_invoices')
        .select('invoice_number')
        .not('invoice_number', 'is', null)
        .order('invoice_number', { ascending: false })
        .limit(1)
        .maybeSingle();

    const [contractResult, manualResult] = await Promise.allSettled([contractQuery, manualQuery]);
    const contractNumber = contractResult.status === 'fulfilled' && !contractResult.value.error
        ? Number(contractResult.value.data?.invoice_number || 0)
        : 0;
    const manualNumber = manualResult.status === 'fulfilled' && !manualResult.value.error
        ? Number(manualResult.value.data?.invoice_number || 0)
        : 0;

    return Math.max(contractNumber, manualNumber, INVOICE_START_NUMBER - 1) + 1;
}

export function calculateSpanishVatFromGross(total: number, vatRate = INVOICE_VAT_RATE) {
    const gross = Math.round(Number(total || 0) * 100) / 100;
    const taxableBase = Math.round((gross / (1 + vatRate)) * 100) / 100;
    const vatAmount = Math.round((gross - taxableBase) * 100) / 100;

    return {
        taxableBase,
        vatRate,
        vatAmount,
        total: gross,
    };
}

function formatEuro(amount: number) {
    return `${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} EUR`;
}

/**
 * Generates a professional PDF buffer for the contract
 */
export async function generateContractPDF(title: string, htmlContent: string, signatureDataUrl: string) {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();
    
    const fontMain = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    
    const margin = 50;
    let y = height - margin;

    const decodeHtml = (text: string) => text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'");

    type TextStyle = {
        bold: boolean;
        italic: boolean;
        underline: boolean;
        strike: boolean;
        size: number;
        indent: number;
    };

    type TextRun = TextStyle & {
        text: string;
        newLine?: boolean;
        paragraphGap?: boolean;
    };

    const baseStyle: TextStyle = {
        bold: false,
        italic: false,
        underline: false,
        strike: false,
        size: 10,
        indent: 0,
    };

    const runs: TextRun[] = [];
    const styleStack: TextStyle[] = [{ ...baseStyle }];
    const currentStyle = () => ({ ...styleStack[styleStack.length - 1] });
    const pushText = (text: string) => {
        const normalized = decodeHtml(text).replace(/\s+/g, ' ');
        if (normalized.trim()) runs.push({ ...currentStyle(), text: normalized });
    };
    const pushBreak = (paragraphGap = false) => runs.push({ ...currentStyle(), text: '', newLine: true, paragraphGap });
    const pushStyle = (changes: Partial<TextStyle>) => styleStack.push({ ...currentStyle(), ...changes });
    const popStyle = () => { if (styleStack.length > 1) styleStack.pop(); };

    htmlContent
        .replace(/<br\s*\/?>/gi, '<br>')
        .split(/(<[^>]+>)/g)
        .forEach((token) => {
            if (!token) return;
            if (!token.startsWith('<')) {
                pushText(token);
                return;
            }

            const tag = token.toLowerCase();
            if (/^<\s*(strong|b)\b/.test(tag)) pushStyle({ bold: true });
            else if (/^<\s*\/\s*(strong|b)\s*>/.test(tag)) popStyle();
            else if (/^<\s*(em|i)\b/.test(tag)) pushStyle({ italic: true });
            else if (/^<\s*\/\s*(em|i)\s*>/.test(tag)) popStyle();
            else if (/^<\s*u\b/.test(tag)) pushStyle({ underline: true });
            else if (/^<\s*\/\s*u\s*>/.test(tag)) popStyle();
            else if (/^<\s*(s|strike)\b/.test(tag)) pushStyle({ strike: true });
            else if (/^<\s*\/\s*(s|strike)\s*>/.test(tag)) popStyle();
            else if (/^<\s*h1\b/.test(tag)) { pushBreak(true); pushStyle({ bold: true, size: 18 }); }
            else if (/^<\s*h2\b/.test(tag)) { pushBreak(true); pushStyle({ bold: true, size: 15 }); }
            else if (/^<\s*h3\b/.test(tag)) { pushBreak(true); pushStyle({ bold: true, size: 12 }); }
            else if (/^<\s*\/\s*h[1-3]\s*>/.test(tag)) { popStyle(); pushBreak(true); }
            else if (/^<\s*p\b/.test(tag)) pushBreak(true);
            else if (/^<\s*\/\s*p\s*>/.test(tag)) pushBreak(true);
            else if (/^<\s*blockquote\b/.test(tag)) { pushBreak(true); pushStyle({ italic: true, indent: 18 }); }
            else if (/^<\s*\/\s*blockquote\s*>/.test(tag)) { popStyle(); pushBreak(true); }
            else if (/^<\s*li\b/.test(tag)) {
                pushBreak(false);
                runs.push({ ...currentStyle(), indent: 16, text: '- ' });
            } else if (/^<\s*\/\s*li\s*>/.test(tag)) pushBreak(false);
            else if (/^<\s*br\s*>/.test(tag)) pushBreak(false);
        });

    const cleanRuns: TextRun[] = [];
    for (const run of runs) {
        if (run.newLine) {
            if (cleanRuns.length === 0) continue;
            const lastRun = cleanRuns[cleanRuns.length - 1];
            if (lastRun.newLine) {
                if (run.paragraphGap) {
                    lastRun.paragraphGap = true;
                }
                continue;
            }
        }
        cleanRuns.push(run);
    }
    while (cleanRuns.length > 0 && cleanRuns[cleanRuns.length - 1].newLine) {
        cleanRuns.pop();
    }

    const getFontForRun = (run: TextRun) => {
        if (run.bold && run.italic) return fontBoldItalic;
        if (run.bold) return fontBold;
        if (run.italic) return fontItalic;
        return fontMain;
    };

    const drawStyledText = (text: string, xPos: number, yPos: number, run: TextRun) => {
        const font = getFontForRun(run);
        page.drawText(text, { x: xPos, y: yPos, size: run.size, font, color: rgb(0.15, 0.15, 0.15) });
        const textWidth = font.widthOfTextAtSize(text, run.size);
        if (run.underline) {
            page.drawLine({ start: { x: xPos, y: yPos - 2 }, end: { x: xPos + textWidth, y: yPos - 2 }, thickness: 0.5, color: rgb(0.15, 0.15, 0.15) });
        }
        if (run.strike) {
            page.drawLine({ start: { x: xPos, y: yPos + run.size * 0.35 }, end: { x: xPos + textWidth, y: yPos + run.size * 0.35 }, thickness: 0.5, color: rgb(0.15, 0.15, 0.15) });
        }
        return textWidth;
    };

    let x = margin;
    let currentLineHeight = 16;
    const maxTextWidth = width - (margin * 2);
    const ensurePageSpace = (needed = 24) => {
        if (y < margin + needed) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }
    };
    const newLine = (gap = 0) => {
        y -= currentLineHeight + gap;
        x = margin;
        currentLineHeight = 16;
        ensurePageSpace(120);
    };

    for (const run of cleanRuns) {
        if (run.newLine) {
            newLine(run.paragraphGap ? 7 : 0);
            continue;
        }

        const words = run.text.split(/(\s+)/).filter(Boolean);
        for (const word of words) {
            const isSpace = /^\s+$/.test(word);
            const drawable = isSpace ? ' ' : word;
            const runX = x === margin ? margin + run.indent : x;
            const font = getFontForRun(run);
            const wordWidth = font.widthOfTextAtSize(drawable, run.size);

            if (!isSpace && runX + wordWidth > margin + maxTextWidth) {
                newLine();
            }
            if (isSpace && x === margin) continue;

            const drawX = x === margin ? margin + run.indent : x;
            currentLineHeight = Math.max(currentLineHeight, run.size * 1.55);
            x = drawX + drawStyledText(drawable, drawX, y, run);
        }
    }

    if (x !== margin) newLine(10);

    // --- Signature ---
    if (signatureDataUrl) {
        y -= 40;
        if (y < 200) {
            page = pdfDoc.addPage([595.28, 841.89]);
            y = height - margin;
        }

        page.drawText('FIRMAS:', { 
            x: margin, 
            y, 
            size: 9, 
            font: fontBold,
            color: rgb(0.4, 0.4, 0.4)
        });
        y -= 22;

        const signatureBoxWidth = 210;
        const signatureBoxHeight = 80;
        const companySealX = width - margin - signatureBoxWidth;
        const signatureImageY = y - signatureBoxHeight;

        page.drawText('Cliente', {
            x: margin,
            y,
            size: 8,
            font: fontBold,
            color: rgb(0.45, 0.45, 0.45)
        });

        page.drawText('LAESE PRODUCCIONES S.L.', {
            x: companySealX,
            y,
            size: 8,
            font: fontBold,
            color: rgb(0.45, 0.45, 0.45)
        });

        try {
            // PNG signature from DataURL
            const base64Data = signatureDataUrl.split(',')[1];
            const sigImageBytes = Buffer.from(base64Data, 'base64');
            const sigImage = await pdfDoc.embedPng(sigImageBytes);
            const sigScale = Math.min(
                signatureBoxWidth / sigImage.width,
                signatureBoxHeight / sigImage.height
            );
            const dims = sigImage.scale(sigScale);
            
            page.drawImage(sigImage, {
                x: margin,
                y: signatureImageY + (signatureBoxHeight - dims.height) / 2,
                width: dims.width,
                height: dims.height,
            });

            try {
                const sealPath = path.join(process.cwd(), 'firmaysello.png');
                const sealImageBytes = await fs.readFile(sealPath);
                const sealImage = await pdfDoc.embedPng(sealImageBytes);
                const sealScale = Math.min(
                    signatureBoxWidth / sealImage.width,
                    signatureBoxHeight / sealImage.height
                );
                const sealDims = sealImage.scale(sealScale);

                page.drawImage(sealImage, {
                    x: companySealX,
                    y: signatureImageY + (signatureBoxHeight - sealDims.height) / 2,
                    width: sealDims.width,
                    height: sealDims.height,
                });
            } catch (sealError) {
                console.error('Error embedding company seal in PDF:', sealError);
            }
            
            // Signature date
            const dateStr = new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' });
            page.drawText(`Fecha: ${dateStr}`, {
                x: margin,
                y: signatureImageY - 18,
                size: 8,
                font: fontMain,
                color: rgb(0.5, 0.5, 0.5)
            });
        } catch (e) {
            console.error('Error embedding signature in PDF:', e);
        }
    }

    // --- Footer ---
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
        const { width } = pages[i].getSize();
        
        // Left side: Company info
        pages[i].drawText(`VideoMarketing Sevilla | www.videomarketingsevilla.com`, {
            x: margin,
            y: 20,
            size: 8,
            font: fontMain,
            color: rgb(0.6, 0.6, 0.6)
        });

        // Right side: Page numbering
        const pageText = `Página ${i + 1} de ${pages.length}`;
        const pageTextWidth = fontMain.widthOfTextAtSize(pageText, 8);
        pages[i].drawText(pageText, {
            x: width - margin - pageTextWidth,
            y: 20,
            size: 8,
            font: fontMain,
            color: rgb(0.6, 0.6, 0.6)
        });
    }

    return await pdfDoc.save();
}

interface InvoicePdfInput {
    invoiceNumber: number;
    issueDate: Date;
    clientName: string;
    clientCif: string;
    clientAddress: string;
    concept: string;
    amount: number;
    contractId?: string;
    paymentMethod?: string;
}

/**
 * Generates a complete Spanish invoice PDF for paid contracts.
 * The Stripe amount is treated as the final total with 21% IVA included.
 */
export async function generateInvoicePDF(input: InvoicePdfInput) {
    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();

    const fontMain = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const margin = 50;
    const carmin = rgb(0.61, 0.11, 0.19);
    const dark = rgb(0.08, 0.08, 0.1);
    const muted = rgb(0.42, 0.42, 0.46);
    const lightLine = rgb(0.88, 0.88, 0.9);

    const date = input.issueDate.toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
    const invoiceRef = formatInvoiceNumber(input.invoiceNumber);
    const vat = calculateSpanishVatFromGross(input.amount);
    const vatPercent = `${Math.round(vat.vatRate * 100)}%`;
    const concept = input.concept || INVOICE_FIXED_CONCEPT;
    const paymentMethod = input.paymentMethod || 'Stripe / tarjeta bancaria';

    page.drawText('FACTURA', { x: margin, y: height - 72, size: 30, font: fontBold, color: dark });
    page.drawText(`Numero: ${invoiceRef}`, { x: margin, y: height - 100, size: 12, font: fontBold, color: carmin });
    page.drawText(`Fecha de expedicion: ${date}`, { x: margin, y: height - 120, size: 10, font: fontMain, color: muted });
    page.drawText(`Fecha de operacion: ${date}`, { x: margin, y: height - 136, size: 10, font: fontMain, color: muted });

    const sellerX = margin;
    const buyerX = width / 2 + 10;
    let y = height - 185;

    page.drawText('Emisor', { x: sellerX, y, size: 11, font: fontBold, color: dark });
    page.drawText('Destinatario', { x: buyerX, y, size: 11, font: fontBold, color: dark });
    y -= 22;

    [
        INVOICE_COMPANY.name,
        `NIF/CIF: ${INVOICE_COMPANY.cif}`,
        INVOICE_COMPANY.address,
        `IBAN: ${INVOICE_COMPANY.iban}`,
    ].forEach((line) => {
        page.drawText(line, { x: sellerX, y, size: 9, font: fontMain, color: dark, maxWidth: 230 });
        y -= 15;
    });

    y = height - 207;
    const buyerLines = [
        input.clientName,
        `CIF/NIF: ${input.clientCif}`,
        input.clientAddress,
        input.contractId ? `Contrato: ${input.contractId}` : null,
    ].filter((line): line is string => Boolean(line));

    buyerLines.forEach((line) => {
        page.drawText(line || '-', { x: buyerX, y, size: 9, font: fontMain, color: dark, maxWidth: 235 });
        y -= 15;
    });

    y = height - 330;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: lightLine });
    y -= 28;

    page.drawText('Descripcion', { x: margin, y, size: 10, font: fontBold, color: muted });
    page.drawText('Base imponible', { x: width - margin - 190, y, size: 9, font: fontBold, color: muted });
    page.drawText('IVA', { x: width - margin - 92, y, size: 9, font: fontBold, color: muted });
    page.drawText('Total', { x: width - margin - 40, y, size: 9, font: fontBold, color: muted });
    y -= 18;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 1, color: lightLine });
    y -= 28;

    page.drawText(concept, {
        x: margin,
        y,
        size: 10,
        font: fontMain,
        color: dark,
        maxWidth: 260,
    });
    page.drawText(formatEuro(vat.taxableBase), { x: width - margin - 190, y, size: 9, font: fontMain, color: dark });
    page.drawText(vatPercent, { x: width - margin - 92, y, size: 9, font: fontMain, color: dark });
    page.drawText(formatEuro(vat.total), { x: width - margin - 72, y, size: 9, font: fontMain, color: dark });

    y -= 70;
    const totalsX = width - margin - 210;
    page.drawLine({ start: { x: totalsX, y }, end: { x: width - margin, y }, thickness: 1, color: lightLine });
    y -= 24;
    page.drawText('Base imponible', { x: totalsX, y, size: 10, font: fontMain, color: dark });
    page.drawText(formatEuro(vat.taxableBase), { x: width - margin - 95, y, size: 10, font: fontMain, color: dark });
    y -= 20;
    page.drawText(`IVA ${vatPercent}`, { x: totalsX, y, size: 10, font: fontMain, color: dark });
    page.drawText(formatEuro(vat.vatAmount), { x: width - margin - 95, y, size: 10, font: fontMain, color: dark });
    y -= 24;
    page.drawText('Total factura', { x: totalsX, y, size: 12, font: fontBold, color: dark });
    page.drawText(formatEuro(vat.total), { x: width - margin - 95, y, size: 12, font: fontBold, color: carmin });

    y -= 45;
    page.drawText(`Forma de pago: ${paymentMethod}.`, {
        x: margin,
        y,
        size: 9,
        font: fontMain,
        color: muted,
    });
    y -= 16;
    page.drawText('Importes calculados con IVA incluido en el total cobrado.', {
        x: margin,
        y,
        size: 8,
        font: fontMain,
        color: muted,
    });

    page.drawText('Factura generada automáticamente tras la confirmación del pago.', {
        x: margin,
        y: 70,
        size: 8,
        font: fontMain,
        color: muted,
    });

    return await pdfDoc.save();
}
