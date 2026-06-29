import { DEFAULT_SETTINGS, Settings } from "./types";

const KEY = "crible_settings";

export async function loadSettings(): Promise<Settings> {
  const stored = (await browser.storage.local.get(KEY)) as Record<string, unknown>;
  const raw = stored[KEY] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(raw ?? {}) };
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: settings });
}

/** Origine ("https://host/*") d'une URL de base, pour la demande de permission d'hôte. */
export function originPattern(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    return `${u.protocol}//${u.host}/*`;
  } catch {
    return null;
  }
}
