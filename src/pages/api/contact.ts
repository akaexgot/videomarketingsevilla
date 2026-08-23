/**
 * Contact Form API Endpoint
 * POST /api/contact
 */
import type { APIRoute } from 'astro';
import { validateCaptcha } from '../../lib/captcha';

export const POST: APIRoute = async ({ request }) => {
    try {
        const data = await request.json();
        const {
            name,
            email,
            phone,
            company,
            message,
            captchaToken,
            captchaAnswer,
            website,
            formStartedAt,
        } = data;

        if (!validateCaptcha({ token: captchaToken, answer: captchaAnswer, website, startedAt: formStartedAt })) {
            return new Response(JSON.stringify({ error: 'Captcha incorrecto' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate required fields
        if (!name || !email || !message) {
            return new Response(JSON.stringify({ error: 'Faltan campos requeridos' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return new Response(JSON.stringify({ error: 'Email inválido' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Store in Supabase (if configured)
        const { supabase } = await import('../../lib/supabase');
        if (supabase) {
            await supabase.from('contacts').insert({
                name,
                email,
                phone: phone || null,
                company: company || null,
                message,
            });
        }

        const notificationTasks: Promise<unknown>[] = [];

        const { sendOwnerNotification } = await import('../../lib/notifications');
        notificationTasks.push(sendOwnerNotification(
            `Nuevo Lead: ${name}`,
            `Mensaje de ${name} (${email}).\nTel: ${phone || 'N/D'}\n${message.substring(0, 100)}${message.length > 100 ? '...' : ''}`
        ));

        // Send email notifications (if Resend is configured)
        if (import.meta.env.RESEND_API_KEY) {
            const { getSettings } = await import('../../lib/data');
            const settings = await getSettings();
            const { sendContactNotification, sendContactAutoReply } = await import('../../lib/resend');
            
            notificationTasks.push(
                sendContactNotification({ 
                    name, email, phone, company, message, 
                    adminEmail: settings.email 
                }),
                sendContactAutoReply({ name, email, phone, company, message })
            );
        }

        await Promise.allSettled(notificationTasks);

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Contact form error:', error);
        return new Response(JSON.stringify({ error: 'Error interno del servidor' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
