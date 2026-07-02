// Orchestration du mode vidéo : transcript brut → transcript propre (par tronçons,
// pour tenir quelle que soit la durée) + résumé + mindmap horodatée avec affirmations
// ancrables par nœud. Réutilise le client LLM et le prompt zététique.

import { chatJSON, chatText } from "./llm";
import { cleanupSystem, videoSystem, videoUser } from "./prompt";
import { AffirmationCle, Settings, TranscriptSegment, VideoAnalysis, VideoSection } from "./types";
import { segmentsToTimedText } from "./youtube";

interface VideoLLMOut {
  resume?: string;
  sections?: {
    titre?: string; timestamp?: string; points?: string[]; affirmations_cles?: AffirmationCle[];
  }[];
}

const MAX_CHUNKS = 40; // borne de sécurité pour les vidéos très longues

/** Regroupe les segments en tronçons d'environ maxChars caractères. */
function chunkSegments(segments: TranscriptSegment[], maxChars = 3500): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = [];
  let cur: TranscriptSegment[] = [];
  let len = 0;
  for (const s of segments) {
    cur.push(s);
    len += s.text.length + 1;
    if (len >= maxChars) { chunks.push(cur); cur = []; len = 0; }
  }
  if (cur.length) chunks.push(cur);
  return chunks.slice(0, MAX_CHUNKS);
}

/** "12:30" ou "1:02:03" → secondes. */
function parseTs(ts: string | undefined): number {
  if (!ts) return 0;
  const parts = ts.split(":").map((p) => parseInt(p, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

export async function buildVideoAnalysis(
  settings: Settings, videoId: string, titre: string, segments: TranscriptSegment[],
): Promise<VideoAnalysis> {
  // 1) Transcript propre, par tronçons (1 appel LLM par tronçon).
  const chunks = chunkSegments(segments);
  const transcriptPropre: { t: number; texte: string }[] = [];
  for (const chunk of chunks) {
    const raw = chunk.map((s) => s.text).join(" ");
    let texte: string;
    try {
      texte = (await chatText(settings, cleanupSystem(settings.language), raw, 0.2)).trim();
    } catch {
      texte = raw; // en cas d'échec d'un tronçon, on garde le brut plutôt que de tout perdre
    }
    transcriptPropre.push({ t: chunk[0]?.start ?? 0, texte });
  }

  // 2) Résumé + mindmap horodatée (1 seul appel), à partir du transcript horodaté.
  const timed = segmentsToTimedText(segments);
  const out = await chatJSON<VideoLLMOut>(
    settings, videoSystem(settings.language), videoUser(titre, timed), 0.3,
  );

  const sections: VideoSection[] = (out.sections ?? []).map((s, i) => ({
    id: `s${i + 1}`,
    titre: s.titre ?? `Section ${i + 1}`,
    timestamp: parseTs(s.timestamp),
    points: s.points ?? [],
    affirmations_cles: (s.affirmations_cles ?? []).filter((a) => a && a.normalisee),
  }));

  return { videoId, titre, resume: out.resume ?? "", sections, transcriptPropre };
}

/** Assemble la note Markdown exportable (équivalent de la note Obsidian). */
export function toMarkdown(a: VideoAnalysis): string {
  const url = `https://www.youtube.com/watch?v=${a.videoId}`;
  const lines: string[] = [];
  lines.push("---");
  lines.push(`titre: "${a.titre.replace(/"/g, "'")}"`);
  lines.push(`source: ${url}`);
  lines.push(`genere_par: Au Crible`);
  lines.push("---", "");
  lines.push(`# ${a.titre}`, "");
  lines.push("## Résumé", "", a.resume, "");
  lines.push("## Mindmap", "");
  for (const s of a.sections) {
    lines.push(`### ${s.titre}`);
    for (const p of s.points) lines.push(`- ${p}`);
    lines.push("");
  }
  lines.push("## Transcription", "");
  for (const p of a.transcriptPropre) lines.push(p.texte, "");
  return lines.join("\n");
}
