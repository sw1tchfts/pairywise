import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Toaster } from '@/components/Toaster';
import { SessionMenu } from '@/components/SessionMenu';
import { HeaderActions } from '@/components/HeaderActions';
import { CloudHydrator } from '@/components/CloudHydrator';
import { LocalListsMigration } from '@/components/LocalListsMigration';
import { getServerClient } from '@/lib/supabase/server';
import { fetchAllListsWith } from '@/lib/cloud/listFetch';
import type { RankList } from '@/lib/types';
import './globals.css';

const themeScript = `
(function() {
  try {
    var t = localStorage.getItem('pairywise-theme');
    var r = document.documentElement;
    r.classList.remove('light', 'dark');
    if (t === 'dark') r.classList.add('dark');
    else if (t === 'light') r.classList.add('light');
  } catch (e) {}
})();
`;

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pairywise — pairwise ranking, your way',
  description:
    'Create a list, vote between pairs, see the ranked leaderboard. Toggle between ELO and Bradley-Terry.',
};

/**
 * Pre-fetch the signed-in user + their lists on the server. Two reasons:
 *
 * 1. The home page hydrates with data already in the HTML — no
 *    "Loading your lists…" spinner, no client-side request waterfall.
 * 2. Reading cookies here automatically opts the layout out of Vercel's
 *    static cache. Without that, every visitor (signed in or not) was
 *    getting the same cached HTML shell — which is what made the home
 *    page look stuck for users whose client-side hydration hadn't fired.
 *
 * On any failure (Supabase down, transient network) we fall back to the
 * client-side hydrator inside <CloudHydrator>.
 */
async function loadInitialState(): Promise<{
  userId: string | null;
  lists: RankList[] | null;
}> {
  try {
    const supabase = await getServerClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    if (!userId) return { userId: null, lists: null };
    const lists = await fetchAllListsWith(supabase, userId);
    return { userId, lists };
  } catch {
    return { userId: null, lists: null };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initial = await loadInitialState();
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <Toaster>
          <header className="border-b border-black/10 dark:border-white/10">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                pairywise
              </Link>
              <nav className="flex items-center gap-2 sm:gap-3 text-sm text-foreground/70">
                <SessionMenu />
                <HeaderActions />
              </nav>
            </div>
          </header>
          <main className="flex-1">
            <CloudHydrator
              initialUserId={initial.userId}
              initialLists={initial.lists}
            >
              {children}
            </CloudHydrator>
            <LocalListsMigration />
          </main>
          <footer className="border-t border-black/10 dark:border-white/10">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 text-xs text-foreground/60">
              pairywise
            </div>
          </footer>
        </Toaster>
      </body>
    </html>
  );
}
