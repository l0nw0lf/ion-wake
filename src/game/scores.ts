const KEY = "ion-wake-scores-v1";
const VERSION = 1;
const MAX = 8;

export type ScoreEntry = {
  name: string;
  score: number;
  wave: number;
  at: number;
};

type SaveBlob = { version: number; entries: ScoreEntry[] };

function migrate(raw: unknown): ScoreEntry[] {
  if (!raw || typeof raw !== "object") return [];
  const blob = raw as Partial<SaveBlob> & { scores?: ScoreEntry[] };
  const list = Array.isArray(blob.entries)
    ? blob.entries
    : Array.isArray(blob.scores)
      ? blob.scores
      : [];
  return sanitize(list);
}

function sanitize(list: unknown[]): ScoreEntry[] {
  return list
    .filter((e): e is ScoreEntry => {
      if (!e || typeof e !== "object") return false;
      const row = e as ScoreEntry;
      return (
        typeof row.name === "string" &&
        typeof row.score === "number" &&
        typeof row.wave === "number"
      );
    })
    .map((e) => ({
      name: e.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ACE",
      score: Math.max(0, Math.floor(e.score)),
      wave: Math.max(1, Math.floor(e.wave)),
      at: typeof e.at === "number" ? e.at : Date.now(),
    }))
    .sort((a, b) => b.score - a.score || a.at - b.at)
    .slice(0, MAX);
}

export function loadScores(): ScoreEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && (parsed as SaveBlob).version === VERSION) {
      return sanitize((parsed as SaveBlob).entries ?? []);
    }
    return migrate(parsed);
  } catch {
    return [];
  }
}

function persist(entries: ScoreEntry[]) {
  try {
    const blob: SaveBlob = { version: VERSION, entries };
    localStorage.setItem(KEY, JSON.stringify(blob));
  } catch {
    /* private mode / quota */
  }
}

export function isHighScore(score: number): boolean {
  if (score <= 0) return false;
  const list = loadScores();
  return list.length < MAX || score > list[list.length - 1].score;
}

export function submitScore(entry: Omit<ScoreEntry, "at"> & { at?: number }): ScoreEntry[] {
  const next = sanitize([
    ...loadScores(),
    { ...entry, at: entry.at ?? Date.now() },
  ]);
  persist(next);
  return next;
}
