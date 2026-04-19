import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Pairywise — pairwise ranking, your way",
  description:
    "Create a list, vote between pairs, see the ranked leaderboard. Toggle between ELO and Bradley-Terry.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="border-b border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              pairywise
            </Link>
            <nav className="flex items-center gap-2 sm:gap-4 text-sm text-foreground/70">
              <Link href="/" className="hover:text-foreground hidden sm:inline">
                My lists
              </Link>
              <Link
                href="/lists/new"
                className="rounded-md bg-foreground text-background px-3 py-1.5 font-medium hover:opacity-90 whitespace-nowrap"
              >
                + New list
              </Link>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-black/10 dark:border-white/10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-4 text-xs text-foreground/60">
            pairywise · client-only MVP · data lives in your browser
          </div>
        </footer>
      </body>
    </html>
  );
}
