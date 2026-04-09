// ai_ranking/ai_rank_normalizer.js

export function clamp01(v) {
  if (v == null || Number.isNaN(v)) return null;
  return Math.max(0, Math.min(1, v));
}

export function normalizePercentLike(v) {
  if (v == null || Number.isNaN(v)) return null;
  if (v > 1.5) return v / 100;
  return v;
}

export function normalizeExpect(v) {
  if (v == null || Number.isNaN(v)) return null;
  if (Math.abs(v) > 10) return v / 100;
  return v;
}
