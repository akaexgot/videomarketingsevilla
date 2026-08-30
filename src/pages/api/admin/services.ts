/**
 * Admin API — Services
 * POST / PUT / DELETE /api/admin/services
 */
import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';
import { invalidateCache } from '../../../lib/data';

export const POST: APIRoute = async ({ request }) => {
    const sb = getServiceSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'DB not configured' }), { status: 500 });

    try {
        const body = await request.json();
        
        // Whitelist valid columns
        const allowed = ['title', 'slug', 'description', 'hero_title', 'hero_subtitle', 'section_title', 'section_text', 'icon', 'video', 'video_vertical', 'preview_seconds', 'order'];
        const filteredBody: any = {};
        for (const key of allowed) {
            if (key in body) filteredBody[key] = body[key];
        }

        if (!filteredBody.slug && filteredBody.title) {
            filteredBody.slug = filteredBody.title
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        const { data, error } = await sb.from('services').insert(filteredBody).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        invalidateCache("services");
        return new Response(JSON.stringify(data), { status: 201 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};

export const PUT: APIRoute = async ({ request }) => {
    const sb = getServiceSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'DB not configured' }), { status: 500 });

    try {
        const body = await request.json();
        const { id } = body;
        if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

        // Whitelist valid columns
        const allowed = ['title', 'slug', 'description', 'hero_title', 'hero_subtitle', 'section_title', 'section_text', 'icon', 'video', 'video_vertical', 'preview_seconds', 'order'];
        const updates: any = {};
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }

        const { data, error } = await sb.from('services').update(updates).eq('id', id).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        invalidateCache("services");
        return new Response(JSON.stringify(data), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};

export const DELETE: APIRoute = async ({ request }) => {
    const sb = getServiceSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'DB not configured' }), { status: 500 });

    try {
        const { id } = await request.json();
        if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400 });

        const { error } = await sb.from('services').delete().eq('id', id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        invalidateCache("services");
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
