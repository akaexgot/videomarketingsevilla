/**
 * Admin API — Settings
 * POST /api/admin/settings
 */
import type { APIRoute } from 'astro';
import { getServiceSupabase } from '../../../lib/supabase';
import { invalidateCache } from '../../../lib/data';

export const POST: APIRoute = async ({ request }) => {
    const sb = getServiceSupabase();
    if (!sb) return new Response(JSON.stringify({ error: 'DB not configured' }), { status: 500 });

    try {
        const body = await request.json();

        const allowedKeys = [
            'site_name', 'site_description', 'logo_url', 'primary_color', 'secondary_color',
            'font_heading', 'font_body', 'whatsapp_number', 'phone', 'email', 'address',
            'instagram', 'linkedin', 'google_maps_embed', 'hero_title', 'hero_subtitle',
            'hero_video_desktop', 'hero_video_mobile',
            'about_corporate_video', 'faq_section_enabled'
        ];

        const updates: Record<string, any> = {};
        Object.keys(body).forEach(key => {
            if (allowedKeys.includes(key)) {
                let value = body[key];
                // Auto-extract src from iframe if user pastes the whole html tag
                if (key === 'google_maps_embed' && typeof value === 'string' && value.includes('<iframe')) {
                    const match = value.match(/src="([^"]+)"/);
                    if (match) value = match[1];
                }
                updates[key] = value;
            }
        });

        // Get existing settings row id
        const { data: existing } = await sb.from('settings').select('id').single();
        if (!existing) {
            return new Response(JSON.stringify({ error: 'No settings row found' }), { status: 404 });
        }

        const { data, error } = await sb
            .from('settings')
            .update(updates)
            .eq('id', existing.id)
            .select()
            .single();

        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
        invalidateCache('settings');
        return new Response(JSON.stringify(data), { status: 200 });
    } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
};
