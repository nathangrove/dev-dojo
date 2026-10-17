import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: {
    default: "Vim Dojo",
    template: "%s · Vim Dojo",
  },
  description:
    "Learn Vim hands-on. Short lessons, real-time practice, and mastery tracking for every command.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="font-mono text-accent">:wq</span>
              <span className="text-foreground">Vim Dojo</span>
            </Link>
            <nav className="flex items-center gap-4 text-xs text-muted">
              <Link href="/" className="transition-colors hover:text-foreground">
                All skills
              </Link>
              <a
                href="https://github.com"
                className="transition-colors hover:text-foreground"
                aria-label="GitHub"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-border py-6">
          <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted">
            Built for hands-on Vim practice. Your progress is stored locally in your browser.
          </div>
        </footer>
      </body>
    </html>
  );
}
