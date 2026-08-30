/**
 * Admin API — Cartas
 * POST / PUT / DELETE /api/admin/cartas
 */
import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';

export const POST: APIRoute = async ({ request }) => {
    const sb = getServiceSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'DB not configured' }), { status: 500 });

    try {
        const body = await request.json();
        
        const allowed = ['nombre', 'slug', 'tipo', 'video_url', 'sample_videos'];
        const filteredBody: any = {};
        for (const key of allowed) {
            if (key in body) filteredBody[key] = body[key];
        }

        if (!filteredBody.slug && filteredBody.nombre) {
            filteredBody.slug = filteredBody.nombre
                .toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)/g, '');
        }
        
        // Insert carta
        const { data, error } = await sb.from('cartas').insert(filteredBody).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
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

        const allowed = ['nombre', 'slug', 'tipo', 'video_url', 'sample_videos'];
        const updates: any = {};
        for (const key of allowed) {
            if (key in body) updates[key] = body[key];
        }

        const { data, error } = await sb.from('cartas').update(updates).eq('id', id).select().single();
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
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

        const { error } = await sb.from('cartas').delete().eq('id', id);
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
