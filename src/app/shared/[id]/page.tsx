import type { Metadata } from 'next';
import { createServerClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase/env';
import { SharedListClient } from './SharedListClient';

type Params = { id: string };

const SITE_URL = 'https://www.pairywise.com';

/**
 * Server-side metadata for /shared/<id> so iMessage, Slack, Twitter, Discord
 * etc. get a rich preview card when someone pastes the link.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { id } = await params;
  const fallback: Metadata = {
    title: 'Pairywise — shared list',
    description: 'You’ve been invited to rank a list on pairywise.',
  };

  // Explicitly no cookies → anon role. RLS on lists allows SELECT when
  // visibility != 'private'.
  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll: () => [],
      setAll: () => {
        /* read-only */
      },
    },
  });

  const { data: row } = await supabase
    .from('lists')
    .select('title, description, visibility')
    .eq('id', id)
    .maybeSingle();
  if (!row || row.visibility === 'private') return fallback;


  const title = row.title as string;
  const description =
    (row.description as string | null) ??
    `You’ve been invited to rank "${title}" on pairywise.`;

  const ogUrl = `${SITE_URL}/api/og-list?listId=${id}`;
  const pageUrl = `${SITE_URL}/shared/${id}`;

  return {
    title: `Rank: ${title}`,
    description,
    openGraph: {
      type: 'website',
      url: pageUrl,
      title: `You’re invited: rank "${title}"`,
      description,
      siteName: 'pairywise',
      images: [{ url: ogUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `You’re invited: rank "${title}"`,
      description,
      images: [ogUrl],
    },
  };
}

export default async function SharedListPage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { id } = await params;
  return <SharedListClient id={id} />;
}
