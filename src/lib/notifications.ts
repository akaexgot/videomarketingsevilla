import { resend } from './resend';

const PUSHOVER_EMAIL = import.meta.env.PUSHOVER_EMAIL;
const PUSHOVER_API_TOKEN = import.meta.env.PUSHOVER_API_TOKEN;
const PUSHOVER_USER_KEY = import.meta.env.PUSHOVER_USER_KEY;

/**
 * Sends a notification to the owner via Pushover.
 * Uses the official Pushover API when configured and falls back to the email bridge.
 * @param title Short title for the notification
 * @param message The main content of the notification
 */
export async function sendOwnerNotification(title: string, message: string) {
    if (PUSHOVER_API_TOKEN && PUSHOVER_USER_KEY) {
        try {
            const response = await fetch('https://api.pushover.net/1/messages.json', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: PUSHOVER_API_TOKEN,
                    user: PUSHOVER_USER_KEY,
                    title,
                    message,
                    priority: '0',
                    sound: 'pushover',
                }),
            });

            if (!response.ok) {
                const details = await response.text().catch(() => '');
                throw new Error(`Pushover API returned ${response.status}: ${details}`);
            }

            return;
        } catch (error) {
            console.error('Error sending Pushover API notification:', error);
        }
    }

    if (!PUSHOVER_EMAIL || !import.meta.env.RESEND_API_KEY) {
        console.warn('Pushover notification skipped: Missing PUSHOVER_API_TOKEN/PUSHOVER_USER_KEY or PUSHOVER_EMAIL/RESEND_API_KEY');
        return;
    }

    try {
        await resend.emails.send({
            from: 'VideoMarketing Sevilla <no-reply@videomarketingsevilla.com>',
            to: PUSHOVER_EMAIL,
            subject: title,
            text: message,
        });
    } catch (error) {
        console.error('Error sending Pushover notification:', error);
    }
}
