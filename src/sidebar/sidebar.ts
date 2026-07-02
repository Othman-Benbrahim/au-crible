import {
  AffirmationCle, Analyse, AnalyzeResponse, ClusterVerdict, EffetDetecte,
  GroundResponse, GroundingResult, Mode, SoliditeBande,
  VideoAnalysis, VideoAnalyzeResponse, VideoSection,
} from "../types";
import { toMarkdown } from "../transcript";
import { fmt } from "../youtube";

type UiMode = "article" | "selection" | "video";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
let mode: UiMode = "article";
const statusEl = $("status");
const resultEl = $("result");

function setStatus(text: string, kind: "info" | "error" | "busy" | null) {
  if (!kind) { statusEl.hidden = true; statusEl.textContent = ""; return; }
  statusEl.hidden = false;
  statusEl.className = `status status--${kind}`;
  statusEl.textContent = text;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, cls?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
}

function section(title: string): HTMLElement {
  const s = el("section", "card");
  s.appendChild(el("h2", "card-title", title));
  return s;
}

// ---------- Rendu commun de l'ancrage (partagé article / vidéo) ----------

function posClass(p: string) {
  return p === "soutient" ? "pos pos--pour"
    : p === "contredit" ? "pos pos--contre"
    : p === "nuance" ? "pos pos--nuance" : "pos pos--hs";
}

function renderCluster(v: ClusterVerdict): HTMLElement {
  const box = el("div", "voix");
  const head = el("div", "voix-head");
  head.appendChild(el("span", posClass(v.classification.position), v.classification.position));
  head.appendChild(el("span", "tag", v.classification.type_preuve));
  if (v.cluster.membres.length >= 2) head.appendChild(el("span", "chip", `${v.cluster.membres.length} sources fondues`));
  head.appendChild(el("span", "muted", `crédibilité ${(v.poids * 100).toFixed(0)} %`));
  box.appendChild(head);
  const links = el("div", "voix-links");
  v.cluster.membres.slice(0, 4).forEach((m) => {
    const a = el("a", "src-link");
    a.textContent = m.domaine || m.url;
    (a as HTMLAnchorElement).href = m.url;
    (a as HTMLAnchorElement).target = "_blank";
    (a as HTMLAnchorElement).rel = "noopener noreferrer";
    links.appendChild(a);
  });
  box.appendChild(links);
  if (v.classification.indices_parti_pris?.length) {
    box.appendChild(el("p", "muted", "Parti pris : " + v.classification.indices_parti_pris.join(", ")));
  }
  return box;
}

function renderGrounding(g: GroundingResult): HTMLElement {
  const card = el("div", "ground");
  card.appendChild(el("div", "ground-band", g.bande));
  card.appendChild(el("div", "ground-resume", g.resume));
  if (g.note) card.appendChild(el("p", "muted", g.note));
  if (g.reportingCirculaire) card.appendChild(el("div", "flag", "⚠ Reporting circulaire : plusieurs reprises d'une même source."));
  g.clusters.filter((v) => v.classification.position !== "hors-sujet").forEach((v) => card.appendChild(renderCluster(v)));
  card.appendChild(el("p", "tiny", "Corroboration pondérée par l'indépendance — indices, pas preuve. À recouper."));
  return card;
}

async function groundOne(claim: AffirmationCle, btn: HTMLButtonElement, slot: HTMLElement) {
  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Recherche…";
  slot.replaceChildren();
  try {
    const res = (await browser.runtime.sendMessage({ type: "GROUND_CLAIM", claim })) as GroundResponse;
    if (!res?.ok || !res.result) {
      slot.appendChild(el("p", "status status--error", res?.error ?? "Échec."));
      btn.disabled = false; btn.textContent = "Réessayer"; return;
    }
    slot.appendChild(renderGrounding(res.result));
    btn.textContent = prev ?? "Revérifier"; btn.disabled = false;
  } catch (e) {
    slot.appendChild(el("p", "status status--error", e instanceof Error ? e.message : "Erreur."));
    btn.disabled = false; btn.textContent = "Réessayer";
  }
}

// ---------- Mode article (V1/V2) ----------

const BANDES: Record<SoliditeBande, number> = {
  "non évaluable": 0, "faiblement étayé": 1, "partiellement étayé": 2, "bien étayé": 3,
};

function renderSolidite(s: Analyse["solidite"]): HTMLElement {
  const card = section("Solidité du raisonnement");
  const meter = el("div", "meter");
  const active = BANDES[s.bande] ?? 0;
  (["faiblement étayé", "partiellement étayé", "bien étayé"] as SoliditeBande[]).forEach((b) => {
    const seg = el("div", "meter-seg");
    if (BANDES[b] <= active && active > 0) seg.classList.add("is-on");
    meter.appendChild(seg);
  });
  card.appendChild(meter);
  card.appendChild(el("div", "band-label", s.bande));
  card.appendChild(el("p", "muted", s.justification));
  return card;
}

function gravClass(g: string) {
  return g === "majeur" ? "chip chip--major" : g === "notable" ? "chip chip--mid" : "chip";
}

function renderEffet(e: EffetDetecte): HTMLElement {
  const item = el("div", "effet");
  const head = el("div", "effet-head");
  head.appendChild(el("span", "effet-nom", e.nom));
  head.appendChild(el("span", "tag", e.categorie));
  head.appendChild(el("span", gravClass(e.gravite), e.gravite));
  item.appendChild(head);
  if (e.passage) { const q = el("blockquote", "passage"); q.textContent = `« ${e.passage} »`; item.appendChild(q); }
  item.appendChild(el("p", "effet-exp", e.explication));
  return item;
}

function affnRow(a: AffirmationCle): HTMLElement {
  const row = el("div", "affn");
  row.appendChild(el("p", "affn-text", a.normalisee || a.verbatim));
  const slot = el("div", "ground-slot");
  if (a.verifiable) {
    const btn = el("button", "ground-btn", "Vérifier les sources");
    btn.addEventListener("click", () => void groundOne(a, btn, slot));
    row.appendChild(btn);
  } else {
    row.appendChild(el("span", "tiny muted", "opinion — non vérifiable"));
  }
  row.appendChild(slot);
  return row;
}

function renderList(title: string, items: string[]): HTMLElement | null {
  if (!items?.length) return null;
  const card = section(title);
  const ul = el("ul", "list");
  items.forEach((t) => ul.appendChild(el("li", undefined, t)));
  card.appendChild(ul);
  return card;
}

function renderAnalyse(a: Analyse, meta?: AnalyzeResponse["meta"]) {
  resultEl.replaceChildren();
  if (meta?.title) resultEl.appendChild(el("div", "doc-title", meta.title));
  const these = section("Thèse"); these.appendChild(el("p", undefined, a.these_principale || "—")); resultEl.appendChild(these);
  if (a.affirmations_cles?.length) {
    const card = section("Affirmations-clés");
    a.affirmations_cles.forEach((x) => card.appendChild(affnRow(x)));
    resultEl.appendChild(card);
  }
  const et = section("Étayage");
  et.appendChild(el("div", "band-label", `Niveau : ${a.etayage?.niveau ?? "—"}`));
  et.appendChild(el("p", "muted", a.etayage?.constat ?? ""));
  resultEl.appendChild(et);
  const effets = section("Effets & biais repérés");
  if (a.effets_detectes?.length) a.effets_detectes.forEach((e) => effets.appendChild(renderEffet(e)));
  else effets.appendChild(el("p", "muted", "Rien de notable repéré dans la forme."));
  resultEl.appendChild(effets);
  resultEl.appendChild(renderSolidite(a.solidite ?? { bande: "non évaluable", justification: "" }));
  const verif = renderList("À vérifier ailleurs", a.a_verifier);
  if (verif) resultEl.appendChild(verif);
}

// ---------- Mode vidéo ----------

function seek(seconds: number) {
  void browser.runtime.sendMessage({ type: "YT_SEEK", seconds });
}

function groundSection(sec: VideoSection, btn: HTMLButtonElement, slot: HTMLElement) {
  const claims = sec.affirmations_cles.filter((a) => a.verifiable);
  if (claims.length === 0) { slot.appendChild(el("p", "tiny muted", "Aucune affirmation vérifiable dans cette section.")); return; }
  btn.disabled = true; btn.textContent = "Enquête…";
  slot.replaceChildren();
  let done = 0;
  claims.forEach((c) => {
    const block = el("div", "sec-claim");
    block.appendChild(el("p", "affn-text", c.normalisee));
    const s = el("div", "ground-slot");
    block.appendChild(s);
    slot.appendChild(block);
    void (async () => {
      try {
        const res = (await browser.runtime.sendMessage({ type: "GROUND_CLAIM", claim: c })) as GroundResponse;
        if (res?.ok && res.result) s.appendChild(renderGrounding(res.result));
        else s.appendChild(el("p", "status status--error", res?.error ?? "Échec."));
      } catch (e) {
        s.appendChild(el("p", "status status--error", e instanceof Error ? e.message : "Erreur."));
      } finally {
        if (++done === claims.length) { btn.disabled = false; btn.textContent = "Réenquêter"; }
      }
    })();
  });
}

function renderNode(sec: VideoSection): HTMLElement {
  const node = el("div", "node");
  const head = el("div", "node-head");
  const title = el("button", "node-title", sec.titre);
  title.addEventListener("click", () => seek(sec.timestamp));
  head.appendChild(title);
  const ts = el("button", "node-ts", fmt(sec.timestamp));
  ts.title = "Aller à ce moment de la vidéo";
  ts.addEventListener("click", () => seek(sec.timestamp));
  head.appendChild(ts);
  node.appendChild(head);
  if (sec.points.length) {
    const ul = el("ul", "list");
    sec.points.forEach((p) => ul.appendChild(el("li", undefined, p)));
    node.appendChild(ul);
  }
  const slot = el("div", "ground-slot");
  const btn = el("button", "ground-btn", "Vérifier cette section");
  btn.addEventListener("click", () => groundSection(sec, btn, slot));
  node.appendChild(btn);
  node.appendChild(slot);
  return node;
}

function downloadMarkdown(a: VideoAnalysis) {
  const blob = new Blob([toMarkdown(a)], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const link = el("a");
  const safe = (a.titre || "video").replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60);
  (link as HTMLAnchorElement).href = url;
  (link as HTMLAnchorElement).download = `au-crible-${safe}.md`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function renderVideo(a: VideoAnalysis) {
  resultEl.replaceChildren();
  if (a.titre) resultEl.appendChild(el("div", "doc-title", a.titre));

  const actions = el("div", "vid-actions");
  const dl = el("button", "ground-btn", "Télécharger .md");
  dl.addEventListener("click", () => downloadMarkdown(a));
  actions.appendChild(dl);
  const cp = el("button", "ground-btn", "Copier .md");
  cp.addEventListener("click", () => { void navigator.clipboard.writeText(toMarkdown(a)); cp.textContent = "Copié ✓"; });
  actions.appendChild(cp);
  resultEl.appendChild(actions);

  const res = section("Résumé");
  res.appendChild(el("p", undefined, a.resume || "—"));
  resultEl.appendChild(res);

  const mm = section("Mindmap  ·  clique un titre pour aller au passage");
  if (a.sections.length) a.sections.forEach((s) => mm.appendChild(renderNode(s)));
  else mm.appendChild(el("p", "muted", "Aucune section détectée."));
  resultEl.appendChild(mm);
}

// ---------- Lancement ----------

async function runArticle() {
  resultEl.replaceChildren();
  setStatus("Analyse en cours… (quelques secondes)", "busy");
  $("run").setAttribute("disabled", "true");
  try {
    const res = (await browser.runtime.sendMessage({ type: "ANALYZE", mode: mode as Mode })) as AnalyzeResponse;
    if (!res?.ok || !res.analyse) { setStatus(res?.error ?? "Échec de l'analyse.", "error"); return; }
    setStatus("", null);
    renderAnalyse(res.analyse, res.meta);
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Erreur inattendue.", "error");
  } finally {
    $("run").removeAttribute("disabled");
  }
}

async function runVideo() {
  resultEl.replaceChildren();
  setStatus("Transcription, mise au propre et mindmap… (peut prendre 30 s et plus)", "busy");
  $("run").setAttribute("disabled", "true");
  try {
    const res = (await browser.runtime.sendMessage({ type: "VIDEO_ANALYZE" })) as VideoAnalyzeResponse;
    if (!res?.ok || !res.analysis) { setStatus(res?.error ?? "Échec de l'analyse vidéo.", "error"); return; }
    setStatus("", null);
    renderVideo(res.analysis);
  } catch (e) {
    setStatus(e instanceof Error ? e.message : "Erreur inattendue.", "error");
  } finally {
    $("run").removeAttribute("disabled");
  }
}

function run() { void (mode === "video" ? runVideo() : runArticle()); }

function selectMode(m: UiMode) {
  mode = m;
  $("mode-article").classList.toggle("is-active", m === "article");
  $("mode-selection").classList.toggle("is-active", m === "selection");
  $("mode-video").classList.toggle("is-active", m === "video");
  $("run").textContent = m === "video" ? "Analyser la vidéo" : "Passer au crible";
}

$("run").addEventListener("click", run);
$("mode-article").addEventListener("click", () => selectMode("article"));
$("mode-selection").addEventListener("click", () => selectMode("selection"));
$("mode-video").addEventListener("click", () => selectMode("video"));
$("open-options").addEventListener("click", () => void browser.runtime.openOptionsPage());
