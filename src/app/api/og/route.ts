import { NextRequest } from 'next/server';
import { errorMessage } from '@/lib/utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return Response.json({ error: 'Missing url' }, { status: 400 });
  }
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400 });
  }
  if (!/^https?:$/.test(target.protocol)) {
    return Response.json({ error: 'Only http/https allowed' }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'pairywise-bot/1.0 (+link preview)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!res.ok) {
      return Response.json({ error: `Upstream ${res.status}` }, { status: 502 });
    }
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return Response.json({ error: 'Not HTML' }, { status: 415 });
    }
    const html = (await res.text()).slice(0, 512 * 1024);

    const pick = (prop: string) =>
      extractMeta(html, 'property', prop) ?? extractMeta(html, 'name', prop);

    const title = pick('og:title') ?? extractTitle(html) ?? target.hostname;
    const description = pick('og:description') ?? pick('description');
    let image = pick('og:image') ?? pick('twitter:image');
    if (image) {
      try {
        image = new URL(image, target).toString();
      } catch {
        image = undefined;
      }
    }

    return Response.json({
      title: title.trim(),
      description: description?.trim(),
      image,
      url: target.toString(),
    });
  } catch (err) {
    return Response.json(
      { error: errorMessage(err, 'Fetch failed') },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

function extractMeta(html: string, attr: string, value: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]*${attr}\\s*=\\s*["']${escapeRegex(value)}["'][^>]*>`,
    'i',
  );
  const match = html.match(re);
  if (!match) return undefined;
  const content = match[0].match(/content\s*=\s*["']([^"']*)["']/i);
  return content?.[1];
}

function extractTitle(html: string): string | undefined {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m?.[1];
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
