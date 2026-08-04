import type { APIRoute } from 'astro';
import { getSiteUrl } from '../lib/seo';

export const prerender = false;

export const GET: APIRoute = async () => {
    const site = getSiteUrl();
    const lastmod = new Date().toISOString().split('T')[0];
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${new URL('/sitemap.xml', `${site}/`).href}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>
</sitemapindex>`;

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'text/xml; charset=UTF-8',
            'Cache-Control': 'public, max-age=0, s-maxage=3600',
            'X-Content-Type-Options': 'nosniff',
        },
    });
};
