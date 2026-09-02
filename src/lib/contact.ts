export function normalizePhoneForHref(phone: string | null | undefined) {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    return raw.startsWith('+') ? `+${digits}` : digits;
}

export function getTelHref(phone: string | null | undefined) {
    const normalized = normalizePhoneForHref(phone);
    return normalized ? `tel:${normalized}` : '';
}

export function getMailtoHref(email: string | null | undefined) {
    const normalized = String(email || '').trim();
    return normalized ? `mailto:${normalized}` : '';
}

export function getWhatsappHref(number: string | null | undefined, text?: string) {
    const normalized = String(number || '').replace(/\D/g, '');
    if (!normalized) return '';

    const suffix = text ? `?text=${encodeURIComponent(text)}` : '';
    return `https://wa.me/${normalized}${suffix}`;
}
