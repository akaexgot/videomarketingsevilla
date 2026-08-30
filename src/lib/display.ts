export type Project = {
  id: string;
  title?: string;
  slug?: string;
  featured_home?: boolean;
  video_project?: string | null;
  [key: string]: unknown;
};

export function getVideoId(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  // support watch?v=, embed/, shorts/, youtu.be/ and raw IDs
  const match = v.match(/(?:(?:youtube(?:-nocookie)?\.com)\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  if (match) return match[1];
  if (/^[A-Za-z0-9_-]{11}$/.test(v)) return v;
  try {
    const u = new URL(v);
    const vid = u.searchParams.get('v');
    if (vid && /^[A-Za-z0-9_-]{11}$/.test(vid)) return vid;
  } catch (e) {
    // not a URL
  }
  return null;
}

/** Check if a URL is an Instagram Reel */
export function isInstagramReel(url?: string | null): boolean {
  if (!url) return false;
  return /instagram\.com\/(reel|reels|p)\//.test(url.trim());
}

/** Extract a clean Instagram embed URL from a reel/post URL */
export function getInstagramEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const match = url.trim().match(/instagram\.com\/(reel|reels|p)\/([A-Za-z0-9_-]+)/);
  if (!match) return null;
  const kind = match[1] === 'p' ? 'p' : 'reel';
  return `https://www.instagram.com/${kind}/${match[2]}/embed/`;
}

export function getVimeoId(value?: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  const match = v.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (match) return match[1];
  return null;
}

export type VideoEmbed = {
  sourceUrl: string;
  embedUrl: string;
  provider: 'youtube' | 'vimeo' | 'instagram' | 'native' | 'unknown';
  orientation: 'vertical' | 'horizontal';
  isNative: boolean;
};

export function getVideoEmbed(value?: string | null): VideoEmbed | null {
  if (!value) return null;

  const sourceUrl = value.trim();
  if (!sourceUrl) return null;

  const lower = sourceUrl.toLowerCase();
  const isNative = lower.includes('cloudinary.com') || lower.endsWith('.mp4') || lower.endsWith('.webm');
  if (isNative) {
    const orientation = /(^|[-_/])(vertical|portrait|reel|short)([-_.?/]|$)/i.test(sourceUrl)
      ? 'vertical'
      : 'horizontal';
    return { sourceUrl, embedUrl: sourceUrl, provider: 'native', orientation, isNative: true };
  }

  const youtubeId = getVideoId(sourceUrl);
  if (youtubeId) {
    const orientation = /\/shorts\//i.test(sourceUrl) ? 'vertical' : 'horizontal';
    return {
      sourceUrl,
      embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=0&loop=1&playsinline=1&rel=0`,
      provider: 'youtube',
      orientation,
      isNative: false,
    };
  }

  const instagramEmbed = getInstagramEmbedUrl(sourceUrl);
  if (instagramEmbed) {
    return {
      sourceUrl,
      embedUrl: instagramEmbed,
      provider: 'instagram',
      orientation: 'vertical',
      isNative: false,
    };
  }

  const vimeoId = getVimeoId(sourceUrl);
  if (vimeoId) {
    return {
      sourceUrl,
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?title=0&byline=0&portrait=0`,
      provider: 'vimeo',
      orientation: 'horizontal',
      isNative: false,
    };
  }

  return {
    sourceUrl,
    embedUrl: sourceUrl,
    provider: 'unknown',
    orientation: /\/shorts\/|instagram\.com\/(reel|reels)\//i.test(sourceUrl) ? 'vertical' : 'horizontal',
    isNative: false,
  };
}

export function toYouTubeEmbed(url?: string | null): string | null {
  const id = getVideoId(url);
  if (!id) return null;
  return `https://www.youtube-nocookie.com/embed/${id}?rel=0`;
}

/**
 * Build screens according to rules:
 * - First screen: up to 3 featured projects (`featured_home`)
 * - Subsequent screens: chunks of up to 4 projects (2x2)
 * - Partial chunks are included (no projects are discarded)
 */
export function buildProjectScreens(all: Project[]): Project[][] {
  const FEATURED_LIMIT = 3;
  const CHUNK_SIZE = 4;

  if (!Array.isArray(all) || all.length === 0) return [];

  const featured = all.filter(p => p.featured_home).slice(0, FEATURED_LIMIT);
  const remaining = all.filter(p => !featured.some(f => f.id === p.id));

  const chunks: Project[][] = [];
  for (let i = 0; i < remaining.length; i += CHUNK_SIZE) {
    const chunk = remaining.slice(i, i + CHUNK_SIZE);
    if (chunk.length > 0) chunks.push(chunk);
  }

  const screens: Project[][] = [];
  if (featured.length > 0) screens.push(featured);
  screens.push(...chunks);
  return screens;
}

export default {
  getVideoId,
  toYouTubeEmbed,
  getVideoEmbed,
  getVimeoId,
  isInstagramReel,
  getInstagramEmbedUrl,
  buildProjectScreens,
};
