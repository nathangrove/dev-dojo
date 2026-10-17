import { Suspense } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { TRACKS, getTrack } from "@/lib/dojo";
import TrackHome from "@/components/TrackHome";

export function generateStaticParams() {
  return TRACKS.map((track) => ({ tool: track.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tool: string }>;
}): Promise<Metadata> {
  const { tool } = await params;
  const track = getTrack(tool);
  if (!track) return { title: "Not found" };
  return { title: track.title, description: track.blurb };
}

export default function TrackPage({ params }: { params: Promise<{ tool: string }> }) {
  return (
    <Suspense fallback={<TrackFallback />}>
      <TrackContent params={params} />
    </Suspense>
  );
}

async function TrackContent({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  const track = getTrack(tool);
  if (!track) notFound();
  return <TrackHome track={track} />;
}

function TrackFallback() {
  return (
    <div className="flex flex-col gap-8">
      <div className="h-3 w-20 animate-pulse rounded bg-panel-2" />
      <div className="h-8 w-48 animate-pulse rounded bg-panel-2" />
      <div className="h-4 w-full max-w-md animate-pulse rounded bg-panel-2" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-panel" />
        ))}
      </div>
    </div>
  );
}
