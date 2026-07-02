import { TranscriptSegment } from "./types";

export function isYouTubeWatch(url: string): boolean {
  return /^https?:\/\/(www\.)?youtube\.com\/watch\?/.test(url) || /^https?:\/\/youtu\.be\//.test(url);
}

/**
 * Fonction AUTONOME injectée dans le MONDE PRINCIPAL de la page YouTube.
 * Ne référence AUCune variable de module (obligatoire pour executeScript) :
 * lit ytInitialPlayerResponse, choisit une piste, récupère les sous-titres json3,
 * et renvoie des segments horodatés.
 */
export async function readTranscriptInPage(
  preferredLangs: string[],
): Promise<{ ok: boolean; videoId?: string; titre?: string; segments?: TranscriptSegment[]; error?: string }> {
  try {
    const pr = (window as unknown as { ytInitialPlayerResponse?: any }).ytInitialPlayerResponse;
    if (!pr) return { ok: false, error: "Réponse du lecteur YouTube introuvable. Recharge la page vidéo." };

    const videoId: string = pr.videoDetails?.videoId ?? "";
    const titre: string = pr.videoDetails?.title ?? document.title.replace(/ - YouTube$/, "");

    const tracks: any[] = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
    if (tracks.length === 0) return { ok: false, error: "Cette vidéo n'a pas de sous-titres disponibles." };

    let track = tracks.find((t) => preferredLangs.includes((t.languageCode || "").split("-")[0]));
    if (!track) track = tracks[0];

    const url = track.baseUrl + (track.baseUrl.includes("fmt=") ? "" : "&fmt=json3");
    const resp = await fetch(url);
    if (!resp.ok) return { ok: false, error: "Échec de récupération des sous-titres (" + resp.status + ")." };
    const data = await resp.json();

    const segments: TranscriptSegment[] = [];
    for (const ev of data.events ?? []) {
      if (!ev.segs) continue;
      const text = ev.segs.map((s: any) => s.utf8 ?? "").join("").replace(/\s+/g, " ").trim();
      if (!text) continue;
      segments.push({ start: (ev.tStartMs ?? 0) / 1000, dur: (ev.dDurationMs ?? 0) / 1000, text });
    }
    if (segments.length === 0) return { ok: false, error: "Sous-titres vides ou illisibles." };
    return { ok: true, videoId, titre, segments };
  } catch (e) {
    return { ok: false, error: "Erreur pendant la lecture des sous-titres : " + (e instanceof Error ? e.message : "inconnue") };
  }
}

/** Concatène les segments en texte horodaté (une ligne par ~tranche), pour le LLM. */
export function segmentsToTimedText(segments: TranscriptSegment[]): string {
  return segments.map((s) => `[${fmt(s.start)}] ${s.text}`).join("\n");
}

export function fmt(sec: number): string {
  const s = Math.floor(sec % 60), m = Math.floor((sec / 60) % 60), h = Math.floor(sec / 3600);
  const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}
