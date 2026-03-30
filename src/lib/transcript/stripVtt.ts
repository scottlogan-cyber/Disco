/**
 * Strip Zoom/WebVTT timing cues and markup so the model sees mostly spoken text.
 */
export function stripVttCues(raw: string): string {
  const t = raw.trim();
  if (!t.toUpperCase().includes("WEBVTT")) {
    return t.replace(/<[^>]+>/g, "").trim();
  }

  let s = t.replace(/^WEBVTT[\s\S]*?(?=\n\n|\n[^\s])/m, "").trim();
  s = s.replace(
    /\d{1,2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}\.\d{3}[^\n]*\n/g,
    "\n"
  );
  s = s.replace(/^\s*NOTE[^\n]*\n/gm, "");
  s = s.replace(/<[^>]+>/g, "");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
