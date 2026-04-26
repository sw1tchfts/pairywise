import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import { Toaster } from '@/components/Toaster';
import { SessionMenu } from '@/components/SessionMenu';
import { HeaderActions } from '@/components/HeaderActions';
import { CloudHydrator } from '@/components/CloudHydrator';
import { LocalListsMigration } from '@/components/LocalListsMigration';
import { getServerClient } from '@/lib/supabase/server';
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
 * Resolve the signed-in user on the server. Reading auth cookies here is
 * what opts the layout out of Vercel's static cache (without it, every
 * visitor got the same cached "Loading…" shell). The lists themselves are
 * hydrated client-side by <CloudHydrator>; pre-fetching them here ran on
 * every route — including admin/profile/signin where the data was never
 * consumed.
 */
async function loadCurrentUserId(): Promise<string | null> {
  try {
    const supabase = await getServerClient();
    const { data } = await supabase.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const initialUserId = await loadCurrentUserId();
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
            <CloudHydrator initialUserId={initialUserId}>
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
