import { useEffect } from "react";

export function useDocumentMeta({
  title,
  description,
  robots,
}: {
  title: string;
  description?: string;
  robots: string;
}) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;

    const desc = ensureMeta("description");
    const previousDesc = desc.getAttribute("content");
    if (description) desc.setAttribute("content", description);

    const robotsEl = ensureMeta("robots");
    const previousRobots = robotsEl.getAttribute("content");
    robotsEl.setAttribute("content", robots);

    return () => {
      document.title = previousTitle;
      if (previousDesc != null) desc.setAttribute("content", previousDesc);
      if (previousRobots != null) robotsEl.setAttribute("content", previousRobots);
    };
  }, [title, description, robots]);
}

function ensureMeta(name: string): HTMLMetaElement {
  const existing = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (existing) return existing;
  const el = document.createElement("meta");
  el.setAttribute("name", name);
  document.head.appendChild(el);
  return el;
}
