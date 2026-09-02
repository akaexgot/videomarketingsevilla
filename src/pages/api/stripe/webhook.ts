import type { APIRoute } from 'astro';
import Stripe from 'stripe';
import { getServiceSupabase } from '../../../lib/supabase';
import {
    generateContractPDF,
    generateInvoicePDF,
    getNextInvoiceNumber,
    replacePlaceholders,
} from '../../../lib/contracts';
import { sendContractCompletedOwnerEmail, sendContractFinalizedEmail } from '../../../lib/resend';
import { sendOwnerNotification } from '../../../lib/notifications';

const stripe = new Stripe(import.meta.env.STRIPE_SECRET_KEY || '', {
    apiVersion: '2025-02-24-preview' as any
});

const endpointSecret = import.meta.env.STRIPE_WEBHOOK_SECRET;

type SupabaseService = NonNullable<ReturnType<typeof getServiceSupabase>>;

function getPaymentIntentId(session: Stripe.Checkout.Session) {
    if (!session.payment_intent) return null;
    return typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;
}

function getCustomerId(session: Stripe.Checkout.Session) {
    if (!session.customer) return null;
    return typeof session.customer === 'string' ? session.customer : session.customer.id;
}

async function getPaymentMethodType(session: Stripe.Checkout.Session) {
    const paymentIntentId = getPaymentIntentId(session);
    if (!paymentIntentId) return session.payment_method_types?.[0] || null;

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ['latest_charge']
        });
        const latestCharge = typeof paymentIntent.latest_charge === 'string'
            ? null
            : paymentIntent.latest_charge;

        return latestCharge?.payment_method_details?.type
            || paymentIntent.payment_method_types?.[0]
            || session.payment_method_types?.[0]
            || null;
    } catch (err) {
        console.error(`Could not retrieve payment method for ${paymentIntentId}:`, err);
        return session.payment_method_types?.[0] || null;
    }
}

async function updatePaymentStatus(
    supabase: SupabaseService,
    session: Stripe.Checkout.Session,
    paymentStatus: 'pending' | 'processing' | 'paid' | 'failed' | 'expired',
    status?: 'pending_payment' | 'completed'
) {
    const contractId = session.metadata?.contract_id;
    if (!contractId) return;

    const updateData: Record<string, any> = {
        payment_id: session.id,
        stripe_customer_id: getCustomerId(session),
        payment_intent_id: getPaymentIntentId(session),
        payment_status: paymentStatus,
        payment_method: await getPaymentMethodType(session),
        updated_at: new Date().toISOString()
    };

    if (paymentStatus === 'paid') updateData.paid_at = new Date().toISOString();
    if (status) updateData.status = status;

    const { error } = await supabase
        .from('contracts')
        .update(updateData)
        .eq('id', contractId);

    if (error) throw error;
}

async function finalizePaidContract(supabase: SupabaseService, session: Stripe.Checkout.Session) {
    const contractId = session.metadata?.contract_id;
    if (!contractId) return;

    const { data: contract, error: fetchErr } = await supabase
        .from('contracts')
        .select('*, contract_templates(*)')
        .eq('id', contractId)
        .single();

    if (fetchErr || !contract) {
        console.error(`Contract ${contractId} not found in webhook`);
        throw new Error('Contract not found');
    }

    const paymentMethod = await getPaymentMethodType(session);
    const paidAt = new Date();

    if (contract.status === 'completed' || contract.invoice_number) {
        const { error: updateErr } = await supabase
            .from('contracts')
            .update({
                payment_id: session.id,
                stripe_customer_id: getCustomerId(session),
                payment_intent_id: getPaymentIntentId(session),
                payment_status: 'paid',
                payment_method: paymentMethod,
                paid_at: contract.paid_at || paidAt.toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', contractId);

        if (updateErr) throw updateErr;
        return;
    }

    if (!contract.signature_svg) {
        await updatePaymentStatus(supabase, session, 'paid', 'pending_payment');
        throw new Error(`Contract ${contractId} was paid before signature was stored`);
    }

    const mergedData = {
        ...contract.admin_data,
        ...contract.client_data,
        CLIENT_EMAIL: contract.client_email,
        CLIENT_PHONE: contract.client_phone
    };
    const finalHtml = replacePlaceholders(contract.contract_templates.content, mergedData);
    const pdfBuffer = await generateContractPDF(contract.title || 'Contrato', finalHtml, contract.signature_svg);

    const invoiceNumber = await getNextInvoiceNumber(supabase);
    const invoiceBuffer = await generateInvoicePDF({
        invoiceNumber,
        issueDate: paidAt,
        clientName: contract.client_data?.CLIENTE_NOMBRE_FISCAL || contract.client_data?.NOMBRE || contract.client_email,
        clientCif: contract.client_data?.CLIENTE_CIF || '',
        clientAddress: contract.client_data?.CLIENTE_DIRECCION || '',
        concept: 'Prestacion de servicios audiovisuales.',
        amount: Number(contract.amount_to_pay || 0),
        contractId,
    });

    const fileName = `contrato_${contractId}.pdf`;
    const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('contracts')
        .upload(fileName, Buffer.from(pdfBuffer), {
            contentType: 'application/pdf',
            upsert: true
        });

    if (uploadErr) throw uploadErr;

    let pdfUrl = '';
    if (uploadData) {
        const { data: urlData } = supabase.storage.from('contracts').getPublicUrl(fileName);
        pdfUrl = urlData.publicUrl;
    }
    if (!pdfUrl) throw new Error('No se pudo generar la URL publica del contrato');

    const invoiceFileName = `factura_${invoiceNumber}_contrato_${contractId}.pdf`;
    const { data: invoiceUploadData, error: invoiceUploadErr } = await supabase.storage
        .from('contracts')
        .upload(invoiceFileName, Buffer.from(invoiceBuffer), {
            contentType: 'application/pdf',
            upsert: true
        });

    if (invoiceUploadErr) throw invoiceUploadErr;

    let invoiceUrl = '';
    if (invoiceUploadData) {
        const { data: invoiceUrlData } = supabase.storage.from('contracts').getPublicUrl(invoiceFileName);
        invoiceUrl = invoiceUrlData.publicUrl;
    }
    if (!invoiceUrl) throw new Error('No se pudo generar la URL publica de la factura');

    const clientName = contract.client_data?.NOMBRE || contract.client_data?.CLIENTE_NOMBRE_FISCAL || 'Cliente';
    if (contract.client_email) {
        await sendContractFinalizedEmail(
            contract.client_email,
            clientName,
            pdfBuffer,
            invoiceBuffer,
            invoiceNumber
        );
        await sendContractCompletedOwnerEmail(
            contract.client_email,
            clientName,
            contract.title || contract.contract_templates?.title || 'Contrato VideoMarketing Sevilla',
            pdfBuffer,
            invoiceBuffer,
            invoiceNumber
        );
    }

    const { error: updateErr } = await supabase
        .from('contracts')
        .update({
            status: 'completed',
            payment_id: session.id,
            stripe_customer_id: getCustomerId(session),
            payment_intent_id: getPaymentIntentId(session),
            payment_status: 'paid',
            payment_method: paymentMethod,
            paid_at: paidAt.toISOString(),
            pdf_url: pdfUrl,
            invoice_number: invoiceNumber,
            invoice_url: invoiceUrl,
            invoice_issued_at: paidAt.toISOString(),
            updated_at: new Date().toISOString()
        })
        .eq('id', contractId);

    if (updateErr) throw updateErr;

    await sendOwnerNotification(
        'Pago RECIBIDO - Contrato Finalizado',
        `El cliente ${contract.client_email} ha pagado ${contract.amount_to_pay} EUR. El contrato ${contract.title} ya esta firmado y archivado. Factura #${invoiceNumber} generada.`
    );
}

export const POST: APIRoute = async ({ request }) => {
    const supabase = getServiceSupabase();
    if (!supabase) return new Response('Supabase error', { status: 500 });

    const sig = request.headers.get('stripe-signature');
    if (!sig || !endpointSecret) {
        console.error('Missing Stripe signature or webhook secret');
        return new Response('Missing signature or secret', { status: 400 });
    }

    let event: Stripe.Event;

    try {
        const body = await request.text();
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session;

            if (session.payment_status === 'paid') {
                await finalizePaidContract(supabase, session);
            } else {
                await updatePaymentStatus(supabase, session, 'processing', 'pending_payment');
                await sendOwnerNotification(
                    'Pago pendiente por transferencia',
                    `Stripe ha creado instrucciones de pago para el contrato ${session.metadata?.contract_id || 'sin id'}. El contrato se finalizara cuando Stripe confirme el cobro.`
                );
            }
        }

        if (event.type === 'checkout.session.async_payment_succeeded') {
            const session = event.data.object as Stripe.Checkout.Session;
            await finalizePaidContract(supabase, session);
        }

        if (event.type === 'checkout.session.async_payment_failed') {
            const session = event.data.object as Stripe.Checkout.Session;
            await updatePaymentStatus(supabase, session, 'failed', 'pending_payment');
            await sendOwnerNotification(
                'Pago fallido',
                `Stripe ha marcado como fallido el pago del contrato ${session.metadata?.contract_id || 'sin id'}.`
            );
        }

        if (event.type === 'checkout.session.expired') {
            const session = event.data.object as Stripe.Checkout.Session;
            await updatePaymentStatus(supabase, session, 'expired', 'pending_payment');
        }
    } catch (err) {
        console.error(`Error processing Stripe webhook ${event.type}:`, err);
        return new Response('Error processing webhook', { status: 500 });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
};
