import { Link, NavLink, Outlet } from "react-router-dom";
import { TRACKS } from "@/lib/dojo";

export default function Layout() {
  const tracks = TRACKS.filter((t) => t.status !== "coming-soon");
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span className="font-mono text-accent">:~$</span>
            <span className="text-foreground">Dev Dojo</span>
          </Link>
          <nav className="flex items-center gap-4 text-xs text-muted">
            {tracks.map((t) => (
              <NavLink
                key={t.slug}
                to={`/${t.slug}`}
                className="transition-colors hover:text-foreground"
              >
                {t.title}
              </NavLink>
            ))}
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        <Outlet />
      </main>
      <footer className="border-t border-border py-6">
        <div className="mx-auto max-w-5xl px-4 text-center text-xs text-muted">
          Built for hands-on practice across developer tools. Your progress is stored locally in
          your browser.
        </div>
      </footer>
    </div>
  );
}
