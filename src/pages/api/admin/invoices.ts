import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';
import { generateInvoicePDF, getNextInvoiceNumber } from '../../../lib/contracts';

function json(payload: unknown, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

function asText(value: unknown) {
    return String(value || '').trim();
}

function asAmount(value: unknown) {
    const amount = Number(String(value || '').replace(',', '.'));
    return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function asDate(value: unknown) {
    const raw = asText(value);
    if (!raw) return new Date();
    return /^\d{4}-\d{2}-\d{2}$/.test(raw)
        ? new Date(`${raw}T12:00:00`)
        : new Date(raw);
}

export const GET: APIRoute = async () => {
    const supabase = getServiceSupabase();
    if (!supabase) return json({ error: 'Supabase no configurado' }, 500);

    const { data, error } = await supabase
        .from('manual_invoices')
        .select('*')
        .order('issued_at', { ascending: false });

    if (error) return json({ error: error.message }, 500);
    return json(data || []);
};

export const POST: APIRoute = async ({ request }) => {
    const supabase = getServiceSupabase();
    if (!supabase) return json({ error: 'Supabase no configurado' }, 500);

    try {
        const body = await request.json();
        const clientName = asText(body.client_name);
        const clientCif = asText(body.client_cif);
        const clientEmail = asText(body.client_email);
        const clientPhone = asText(body.client_phone);
        const clientAddress = asText(body.client_address);
        const concept = asText(body.concept);
        const paymentMethod = asText(body.payment_method) || 'Transferencia bancaria';
        const issuedAt = asDate(body.issued_at);
        const amount = asAmount(body.amount);

        if (!clientName || !concept || amount <= 0) {
            return json({ error: 'Cliente, concepto e importe son obligatorios.' }, 400);
        }

        if (Number.isNaN(issuedAt.getTime())) {
            return json({ error: 'La fecha de emision no es valida.' }, 400);
        }

        const invoiceNumber = await getNextInvoiceNumber(supabase);
        const invoiceBuffer = await generateInvoicePDF({
            invoiceNumber,
            issueDate: issuedAt,
            clientName,
            clientCif,
            clientAddress,
            concept,
            amount,
            paymentMethod,
        });

        const fileName = `factura_${invoiceNumber}_manual.pdf`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('contracts')
            .upload(fileName, Buffer.from(invoiceBuffer), {
                contentType: 'application/pdf',
                upsert: true,
            });

        if (uploadError) throw uploadError;

        let invoiceUrl = '';
        if (uploadData) {
            const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName);
            invoiceUrl = urlData.publicUrl;
        }
        if (!invoiceUrl) throw new Error('No se pudo generar la URL publica de la factura');

        const { data, error } = await supabase
            .from('manual_invoices')
            .insert({
                invoice_number: invoiceNumber,
                client_name: clientName,
                client_cif: clientCif || null,
                client_email: clientEmail || null,
                client_phone: clientPhone || null,
                client_address: clientAddress || null,
                concept,
                amount,
                payment_method: paymentMethod,
                status: 'issued',
                invoice_url: invoiceUrl,
                issued_at: issuedAt.toISOString(),
            })
            .select()
            .single();

        if (error) throw error;
        return json(data, 201);
    } catch (error: any) {
        return json({ error: error.message || 'Error al crear la factura' }, 500);
    }
};

export const PATCH: APIRoute = async ({ request }) => {
    const supabase = getServiceSupabase();
    if (!supabase) return json({ error: 'Supabase no configurado' }, 500);

    try {
        const { id, status } = await request.json();
        if (!id || !status) return json({ error: 'Faltan datos requeridos' }, 400);

        const { data, error } = await supabase
            .from('manual_invoices')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return json(data);
    } catch (error: any) {
        return json({ error: error.message || 'Error al actualizar la factura' }, 500);
    }
};
