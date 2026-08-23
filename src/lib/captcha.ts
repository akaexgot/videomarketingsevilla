import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const CAPTCHA_TTL_MS = 30 * 60 * 1000;
const MIN_FORM_FILL_MS = 2500;
const runtimeSecret = randomBytes(32).toString('hex');
const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CAPTCHA_LENGTH = 6;

function getSecret() {
    return (
        import.meta.env.CAPTCHA_SECRET ||
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY ||
        import.meta.env.RESEND_API_KEY ||
        runtimeSecret
    );
}

function sign(payload: string) {
    return createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function safeCompare(a: string, b: string) {
    const left = Buffer.from(a);
    const right = Buffer.from(b);

    return left.length === right.length && timingSafeEqual(left, right);
}

export function createCaptchaChallenge() {
    const code = Array.from({ length: CAPTCHA_LENGTH }, () => {
        return CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    }).join('');
    const expiresAt = Date.now() + CAPTCHA_TTL_MS;
    const nonce = randomBytes(12).toString('hex');
    const answerHash = sign(`${nonce}.${code}`);
    const payload = `${answerHash}.${expiresAt}.${nonce}`;
    const signature = sign(payload);
    const image = createCaptchaImage(code);

    return {
        token: `${payload}.${signature}`,
        startedAt: String(Date.now()),
        image,
    };
}

function createCaptchaImage(code: string) {
    const chars = code.split('');
    const text = chars.map((char, index) => {
        const x = 25 + index * 27;
        const y = 45 + Math.round((Math.random() - 0.5) * 10);
        const rotate = Math.round((Math.random() - 0.5) * 22);
        return `<text x="${x}" y="${y}" transform="rotate(${rotate} ${x} ${y})">${char}</text>`;
    }).join('');

    const lines = Array.from({ length: 6 }, () => {
        const x1 = Math.floor(Math.random() * 190);
        const y1 = Math.floor(Math.random() * 62);
        const x2 = Math.floor(Math.random() * 190);
        const y2 = Math.floor(Math.random() * 62);
        const opacity = (0.12 + Math.random() * 0.18).toFixed(2);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" opacity="${opacity}" />`;
    }).join('');

    const dots = Array.from({ length: 26 }, () => {
        const cx = Math.floor(Math.random() * 190);
        const cy = Math.floor(Math.random() * 62);
        const opacity = (0.18 + Math.random() * 0.22).toFixed(2);
        return `<circle cx="${cx}" cy="${cy}" r="1" opacity="${opacity}" />`;
    }).join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="62" viewBox="0 0 190 62" role="img" aria-label="Captcha"><rect width="190" height="62" rx="12" fill="#f9fafb"/><path d="M0 42 C38 22 72 62 110 34 S164 18 190 36" fill="none" stroke="#e11d48" stroke-width="3" opacity=".16"/><g stroke="#111827" stroke-width="1.5">${lines}</g><g fill="#9b1b30">${dots}</g><g fill="#111827" font-family="Outfit, Arial, sans-serif" font-size="30" font-weight="800" letter-spacing="4">${text}</g></svg>`;

    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function validateCaptcha(input: {
    token?: unknown;
    answer?: unknown;
    website?: unknown;
    startedAt?: unknown;
}) {
    if (typeof input.website === 'string' && input.website.trim() !== '') {
        return false;
    }

    if (
        typeof input.token !== 'string' ||
        typeof input.answer !== 'string' ||
        typeof input.startedAt !== 'string'
    ) {
        return false;
    }

    const startedAt = Number(input.startedAt);
    if (!Number.isFinite(startedAt) || Date.now() - startedAt < MIN_FORM_FILL_MS) {
        return false;
    }

    const parts = input.token.split('.');
    if (parts.length !== 4) {
        return false;
    }

    const [answerHash, expiresRaw, nonce, signature] = parts;
    const payload = `${answerHash}.${expiresRaw}.${nonce}`;

    if (!safeCompare(signature, sign(payload))) {
        return false;
    }

    const expiresAt = Number(expiresRaw);
    const answer = input.answer.trim().replace(/[\s-]/g, '').toUpperCase();

    if (!Number.isFinite(expiresAt) || answer.length !== CAPTCHA_LENGTH) {
        return false;
    }

    return Date.now() <= expiresAt && safeCompare(answerHash, sign(`${nonce}.${answer}`));
}
