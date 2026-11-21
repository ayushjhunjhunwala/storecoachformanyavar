// Replay window shown by the bar (the engine's 31 daily runs).
export const REPLAY_START = "2026-10-01";
export const REPLAY_END = "2026-10-31";
export const PLAY_INTERVAL_MS = 1500;

export const REPLAY_DATES: string[] = (() => {
  const out: string[] = [];
  const end = new Date(`${REPLAY_END}T00:00:00Z`).getTime();
  for (let t = new Date(`${REPLAY_START}T00:00:00Z`).getTime(); t <= end; t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
})();
