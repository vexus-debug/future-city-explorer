import { createFileRoute } from "@tanstack/react-router";
import { CityExplorer } from "@/components/city/CityExplorer";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Future City 5.5 — World Explorer" },
    { name: "description", content: "Explore a futuristic metropolis, monumental pyramid, and elevated neon skyways in an interactive mobile 3D city." },
    { property: "og:title", content: "Future City 5.5 — World Explorer" },
    { property: "og:description", content: "Enter a living sci-fi skyline and explore its pyramid, towers, and elevated skyways." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CityExplorer,
});
