import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { getTrack } from "@/lib/dojo";
import TrackHome from "@/components/TrackHome";
import NotFound from "@/routes/NotFound";

export default function TrackPage() {
  const { tool } = useParams<{ tool: string }>();
  const track = tool ? getTrack(tool) : undefined;

  useEffect(() => {
    if (track) document.title = `${track.title} · Dev Dojo`;
    return () => {
      document.title = "Dev Dojo";
    };
  }, [track]);

  if (!track) return <NotFound />;
  return <TrackHome track={track} />;
}
