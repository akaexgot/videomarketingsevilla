import type { APIRoute } from 'astro';
import { getProjects, getServices, getSectors } from '../lib/data';
import { getSiteUrl } from '../lib/seo';

export const prerender = false;

type SitemapPage = {
    url: string;
    priority: string;
    changefreq: 'weekly' | 'monthly' | 'yearly';
    lastmod?: string | null;
};

type SluggedPage = {
    slug?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
};

const staticPages: SitemapPage[] = [
    { url: '/', priority: '1.0', changefreq: 'weekly' },
    { url: '/proyectos', priority: '0.9', changefreq: 'weekly' },
    { url: '/servicios', priority: '0.9', changefreq: 'monthly' },
    { url: '/sectores', priority: '0.9', changefreq: 'monthly' },
    { url: '/quienes-somos', priority: '0.8', changefreq: 'monthly' },
    { url: '/contacto', priority: '0.8', changefreq: 'monthly' },
    { url: '/privacidad', priority: '0.3', changefreq: 'yearly' },
    { url: '/aviso-legal', priority: '0.3', changefreq: 'yearly' },
    { url: '/cookies', priority: '0.3', changefreq: 'yearly' },
];

function escapeXml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function formatDate(value: string | null | undefined) {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return date.toISOString().split('T')[0];
}

function dynamicPages(items: SluggedPage[], basePath: string, priority: string): SitemapPage[] {
    return items
        .filter((item) => item.slug)
        .map((item) => ({
            url: `${basePath}/${item.slug}`,
            priority,
            changefreq: 'monthly',
            lastmod: item.updated_at || item.created_at || null,
        }));
}

export const GET: APIRoute = async () => {
    const site = getSiteUrl();

    const [projectsResult, servicesResult, sectorsResult] = await Promise.allSettled([
        getProjects(),
        getServices(),
        getSectors(),
    ]);

    const projects = projectsResult.status === 'fulfilled' ? projectsResult.value : [];
    const services = servicesResult.status === 'fulfilled' ? servicesResult.value : [];
    const sectors = sectorsResult.status === 'fulfilled' ? sectorsResult.value : [];

    const allPages: SitemapPage[] = [
        ...staticPages,
        ...dynamicPages(projects, '/proyectos', '0.7'),
        ...dynamicPages(services, '/servicios', '0.8'),
        ...dynamicPages(sectors, '/sectores', '0.8'),
    ];
    const uniquePages = Array.from(new Map(allPages.map((page) => [page.url, page])).values());

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${uniquePages
    .map((page) => {
        const lastmod = formatDate(page.lastmod);
        return `  <url>
    <loc>${escapeXml(new URL(page.url, `${site}/`).href)}</loc>${lastmod ? `
    <lastmod>${lastmod}</lastmod>` : ''}
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    })
    .join('\n')}
</urlset>`;

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
};
