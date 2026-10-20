import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { getCategory, getTrack } from "@/lib/dojo";
import CategoryLessons from "@/components/CategoryLessons";
import NotFound from "@/routes/NotFound";

export default function CategoryPage() {
  const { tool, slug } = useParams<{ tool: string; slug: string }>();
  const track = tool ? getTrack(tool) : undefined;
  const category = tool && slug ? getCategory(tool, slug) : undefined;

  useEffect(() => {
    if (category) document.title = `${category.title} · Dev Dojo`;
    return () => {
      document.title = "Dev Dojo";
    };
  }, [category]);

  if (!tool || !track || !category) return <NotFound />;
  return <CategoryLessons toolSlug={tool} category={category} />;
}
