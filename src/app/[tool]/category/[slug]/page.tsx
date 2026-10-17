import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TRACKS, getCategory, getTrack } from "@/lib/dojo";
import CategoryLessons from "@/components/CategoryLessons";

interface Params {
  params: Promise<{ tool: string; slug: string }>;
}

export function generateStaticParams() {
  return TRACKS.flatMap((track) =>
    track.categories.map((category) => ({ tool: track.slug, slug: category.slug })),
  );
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { tool, slug } = await params;
  const category = getCategory(tool, slug);
  if (!category) return { title: "Not found" };
  return { title: category.title, description: category.blurb };
}

export default function CategoryPage({ params }: Params) {
  return (
    <Suspense fallback={<CategoryFallback />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({ params }: Params) {
  const { tool, slug } = await params;
  const track = getTrack(tool);
  const category = getCategory(tool, slug);
  if (!track || !category) notFound();
  return <CategoryLessons toolSlug={tool} category={category} />;
}

function CategoryFallback() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-3 w-20 animate-pulse rounded bg-panel-2" />
      <div className="h-8 w-48 animate-pulse rounded bg-panel-2" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-panel-2" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl border border-border bg-panel" />
        ))}
      </div>
    </div>
  );
}
