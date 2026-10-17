import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CATEGORIES, getCategory } from "@/lib/curriculum";
import CategoryLessons from "@/components/CategoryLessons";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) return { title: "Not found" };
  return { title: category.title, description: category.blurb };
}

export default function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<CategoryFallback />}>
      <CategoryContent params={params} />
    </Suspense>
  );
}

async function CategoryContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();
  return <CategoryLessons category={category} />;
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
