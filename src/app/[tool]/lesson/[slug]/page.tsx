import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { allLessons, getLesson } from "@/lib/dojo";
import Markdownish from "@/components/Markdownish";
import LessonPlayer from "@/components/LessonPlayer";

interface Params {
  params: Promise<{ tool: string; slug: string }>;
}

export function generateStaticParams() {
  return allLessons().map((ref) => ({ tool: ref.track.slug, slug: ref.lesson.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool, slug } = await params;
  const ref = getLesson(tool, slug);
  if (!ref) return { title: "Not found" };
  return { title: ref.lesson.title, description: ref.lesson.tagline };
}

export default function LessonPage({ params }: Params) {
  return (
    <Suspense fallback={<LessonFallback />}>
      <LessonContent params={params} />
    </Suspense>
  );
}

async function LessonContent({ params }: Params) {
  const { tool, slug } = await params;
  const ref = getLesson(tool, slug);
  if (!ref) notFound();
  const { category, lesson } = ref;

  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Link
          href={`/${tool}/category/${category.slug}`}
          className="w-fit text-xs text-muted transition-colors hover:text-foreground"
        >
          ← {category.title}
        </Link>
        <div className="flex items-baseline gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{lesson.title}</h1>
          <span className="font-mono text-sm text-muted">{lesson.tagline}</span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <section className="flex flex-col gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Concept</h2>
          <Markdownish text={lesson.concept} />
        </section>
        <aside className="flex flex-col gap-3">
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Commands</h2>
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-panel">
            {lesson.keys.map((k) => (
              <li key={k.keys} className="flex items-center gap-3 px-3 py-2">
                <kbd className="rounded bg-panel-2 px-2 py-1 font-mono text-xs text-cyan">
                  {k.keys}
                </kbd>
                <span className="text-xs text-muted">{k.meaning}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted">Practice</h2>
        <LessonPlayer toolSlug={tool} lesson={lesson} category={category} />
      </section>
    </div>
  );
}

function LessonFallback() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <div className="h-3 w-24 animate-pulse rounded bg-panel-2" />
        <div className="h-7 w-56 animate-pulse rounded bg-panel-2" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
        <div className="flex flex-col gap-3">
          <div className="h-4 w-full max-w-md animate-pulse rounded bg-panel-2" />
          <div className="h-4 w-full max-w-sm animate-pulse rounded bg-panel-2" />
          <div className="h-4 w-full max-w-lg animate-pulse rounded bg-panel-2" />
        </div>
        <div className="h-40 animate-pulse rounded-lg border border-border bg-panel" />
      </div>
      <div className="h-64 animate-pulse rounded-xl border border-border bg-panel" />
    </div>
  );
}
