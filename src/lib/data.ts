/**
 * Data fetching layer
 * Tries Supabase first, falls back to static data for development
 */
import { supabase, getServiceSupabase } from './supabase';
import * as fallback from '../data/fallback';

const PUBLIC_DATA_TTL_MS = Number(import.meta.env.PUBLIC_DATA_TTL_MS || 30 * 60 * 1000);
const PUBLIC_QUERY_TIMEOUT_MS = Number(import.meta.env.SUPABASE_QUERY_TIMEOUT_MS || 2500);
const PUBLIC_ERROR_COOLDOWN_MS = Number(import.meta.env.PUBLIC_ERROR_COOLDOWN_MS || 60 * 1000);

type CacheEntry<T> = {
    value?: T;
    expiresAt: number;
    retryAt: number;
    promise?: Promise<T>;
};

const publicDataCache = new Map<string, CacheEntry<unknown>>();

class PublicQueryTimeoutError extends Error {}

async function withPublicTimeout<T>(promise: PromiseLike<T>): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const timeout = new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new PublicQueryTimeoutError('Public query timeout')), PUBLIC_QUERY_TIMEOUT_MS);
    });

    const result = await Promise.race([promise, timeout]);
    if (timeoutId) clearTimeout(timeoutId);

    return result;
}

function publicQuery<T>(
    key: string,
    queryFactory: () => PromiseLike<{ data: T | null; error: unknown }>,
    fallbackValue: T
): Promise<T> {
    const now = Date.now();
    const entry = publicDataCache.get(key) as CacheEntry<T> | undefined;

    if (entry?.value !== undefined && entry.expiresAt > now) {
        return Promise.resolve(entry.value);
    }

    if (entry?.promise) {
        return entry.promise.catch(() => entry.value ?? fallbackValue);
    }

    if (entry && now < entry.retryAt) {
        return Promise.resolve(entry.value ?? fallbackValue);
    }

    const promise = (async () => {
        const { data, error } = await withPublicTimeout(queryFactory());

        if (error) throw error;
        if (data === null) throw new Error(`${key} returned no data`);

        publicDataCache.set(key, {
            value: data,
            expiresAt: Date.now() + PUBLIC_DATA_TTL_MS,
            retryAt: 0,
        });

        return data;
    })().catch(() => {
        const previous = publicDataCache.get(key) as CacheEntry<T> | undefined;
        const value = previous?.value ?? fallbackValue;

        publicDataCache.set(key, {
            value,
            expiresAt: previous?.value !== undefined ? previous.expiresAt : Date.now() + PUBLIC_ERROR_COOLDOWN_MS,
            retryAt: Date.now() + PUBLIC_ERROR_COOLDOWN_MS,
        });

        return value;
    });

    publicDataCache.set(key, {
        value: entry?.value,
        expiresAt: entry?.expiresAt ?? 0,
        retryAt: entry?.retryAt ?? 0,
        promise,
    });

    return promise;
}

/** Fetch site settings */
export async function getSettings() {
    if (!supabase) return fallback.siteSettings;

    return publicQuery(
        'settings',
        () => supabase.from('settings').select('*').single(),
        fallback.siteSettings
    );
}

/** Fetch custom SEO metadata for a public page */
export async function getPageSeo(pagePath: string) {
    if (!supabase) return null;

    const normalizedPath = pagePath.length > 1 ? pagePath.replace(/\/+$/, '') : '/';

    return publicQuery(
        `page-seo:${normalizedPath}`,
        () => supabase.from('pages_seo').select('*').eq('page_path', normalizedPath).maybeSingle(),
        null
    );
}

/** Fetch navigation items */
export async function getNavigation() {
    if (!supabase) return fallback.navigation;

    return publicQuery(
        'navigation',
        () => supabase.from('navigation').select('*').order('order', { ascending: true }),
        fallback.navigation
    );
}

/** Fetch all projects */
export async function getProjects() {
    if (!supabase) return fallback.projects;

    return publicQuery(
        'projects',
        () => supabase.from('projects').select('*').order('order', { ascending: true }),
        fallback.projects
    );
}

/** Fetch featured projects for home page */
export async function getFeaturedProjects() {
    if (!supabase) return fallback.projects.filter(p => p.featured_home);

    return publicQuery(
        'featured-projects',
        () => supabase.from('projects').select('*').eq('featured_home', true).order('order', { ascending: true }),
        fallback.projects.filter(p => p.featured_home)
    );
}

/** Fetch single project by slug */
export async function getProjectBySlug(slug: string) {
    if (!supabase) return fallback.projects.find(p => p.slug === slug) || null;

    return publicQuery(
        `project:${slug}`,
        () => supabase.from('projects').select('*').eq('slug', slug).single(),
        null
    );
}

/** Fetch all services */
export async function getServices() {
    if (!supabase) return fallback.services;

    return publicQuery(
        'services',
        () => supabase.from('services').select('*').order('order', { ascending: true }),
        fallback.services
    );
}

/** Fetch single service by slug */
export async function getServiceBySlug(slug: string) {
    if (!supabase) return fallback.services.find(s => s.slug === slug) || null;

    return publicQuery(
        `service:${slug}`,
        () => supabase.from('services').select('*').eq('slug', slug).single(),
        null
    );
}

/** Fetch all sectors */
export async function getSectors() {
    if (!supabase) return fallback.sectors;

    return publicQuery(
        'sectors',
        () => supabase.from('sectors').select('*').order('order', { ascending: true }),
        fallback.sectors
    );
}

/** Fetch single sector by slug */
export async function getSectorBySlug(slug: string) {
    if (!supabase) return fallback.sectors.find(s => s.slug === slug) || null;

    return publicQuery(
        `sector:${slug}`,
        () => supabase.from('sectors').select('*').eq('slug', slug).single(),
        null
    );
}

/** Fetch companies (logo carousel) */
export async function getCompanies() {
    if (!supabase) return fallback.companies;

    return publicQuery(
        'companies',
        () => supabase.from('companies').select('*').order('order', { ascending: true }),
        fallback.companies
    );
}

/** Fetch awards (logo carousel) */
export async function getAwards() {
    if (!supabase) return [];

    return publicQuery(
        'awards',
        () => supabase.from('awards').select('*').order('order', { ascending: true }),
        []
    );
}

/** Fetch FAQs */
export async function getFaqs() {
    if (!supabase) return fallback.faqs || [];

    return publicQuery(
        'faqs',
        () => supabase.from('faqs').select('*').eq('is_active', true).order('order', { ascending: true }),
        fallback.faqs || []
    );
}

/** Fetch footer data */
export async function getFooterData() {
    if (!supabase) return fallback.footerData;

    return publicQuery(
        'footer',
        () => supabase.from('footer').select('*').single(),
        fallback.footerData
    );
}

/** Fetch portal clients (public — RLS filters active only) */
export async function getPortalClients() {
    if (!supabase) return [];
    const sb = supabase;

    return publicQuery(
        'portal-clients',
        () => sb
            .from('portal_clients')
            .select('*')
            .order('order', { ascending: true })
            .order('created_at', { ascending: true })
            .order('id', { ascending: true }),
        []
    );
}

/** Fetch ALL portal clients (admin — bypasses RLS) */
export async function getPortalClientsAdmin() {
    const sb = getServiceSupabase();
    if (!sb) return [];

    const { data, error } = await sb
        .from('portal_clients')
        .select('*')
        .order('order', { ascending: true })
        .order('created_at', { ascending: true })
        .order('id', { ascending: true });

    if (error || !data) return [];
    return data;
}

/** Invalidate in-memory public data cache after admin mutations */
export function invalidateCache(tag?: string) {
    if (!tag) {
        publicDataCache.clear();
        return;
    }

    publicDataCache.delete(tag);

    if (tag === 'projects') {
        publicDataCache.delete('featured-projects');
        for (const key of publicDataCache.keys()) {
            if (key.startsWith('project:')) publicDataCache.delete(key);
        }
    }

    if (tag === 'services') {
        for (const key of publicDataCache.keys()) {
            if (key.startsWith('service:')) publicDataCache.delete(key);
        }
    }

    if (tag === 'sectors') {
        for (const key of publicDataCache.keys()) {
            if (key.startsWith('sector:')) publicDataCache.delete(key);
        }
    }

    if (tag === 'portal-clients') {
        publicDataCache.delete('portal-clients');
    }
}
