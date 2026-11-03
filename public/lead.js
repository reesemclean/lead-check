// Lead Check — pure math and state helpers. No DOM access; imported by index.html and the tests.

export const MIN_CANDS = 2;
export const MAX_CANDS = 6;
export const MAX_BATCHES = 8;

export const clamp = (x, a, b) => Math.min(Math.max(x, a), b);
export const num = s => { const n = parseFloat(String(s).replace(/[^0-9.]/g, '')); return isFinite(n) ? n : 0; };
export const sum = arr => arr.reduce((a, b) => a + b, 0);

/** Indices of `arr`, highest value first. */
export const rank = arr => arr.map((_, i) => i).sort((a, b) => arr[b] - arr[a]);

/** Non-negative weights → fractions summing to 1 (even split if all zero). */
export function normalize(w) {
  const c = w.map(x => Math.max(0, +x || 0));
  const t = sum(c);
  return t > 0 ? c.map(x => x / t) : c.map(() => 1 / c.length);
}

/** Votes counted per candidate, from either entry mode. */
export function counted({ mode, total, cands }) {
  if (mode === 'votes') return cands.map(c => Math.max(0, c.votes));
  return cands.map(c => total * Math.max(0, c.pct) / 100);
}

/** Remaining votes implied by C counted at pInPct% of the expected total. */
export function remaining(C, pInPct) {
  const p = clamp(pInPct, 0.1, 100) / 100;
  return p >= 1 ? 0 : C / p - C;
}

/**
 * Project final totals.
 * v: counted votes per candidate; pIn: % of expected vote counted;
 * shares: each candidate's weight for the remaining vote not in a batch (normalized here);
 * batches: known pieces of the remaining vote, [{ label, votes, shares }], each with its own split.
 *
 * Batches are carved out of the remaining vote implied by pIn; whatever is left ("rest")
 * goes at `shares`. If batches add up to more than that estimate, they are the whole
 * remaining vote (rest = 0) and `over` is true.
 *
 * Returns s: each candidate's effective share of ALL remaining votes, and add: votes gained.
 */
export function project({ v, pIn, shares, batches = [] }) {
  const C = sum(v);
  const est = remaining(C, pIn);
  const pick = w => normalize(v.map((_, i) => w?.[i] ?? 0));
  const s0 = pick(shares);
  const pools = batches.map(b => ({ label: b.label, n: Math.max(0, +b.votes || 0), s: pick(b.shares) }))
    .filter(p => p.n > 0);
  const B = sum(pools.map(p => p.n));
  const rest = Math.max(0, est - B);
  const R = B + rest;
  const add = v.map((_, i) => rest * s0[i] + sum(pools.map(p => p.n * p.s[i])));
  const s = R > 0 ? add.map(x => x / R) : s0;
  const f = v.map((x, i) => x + add[i]);
  return { v, C, est, B, rest, R, T: C + R, s, add, f, pools, over: B > est };
}

/**
 * Fraction of ALL remaining votes the runner-up (b) needs to pass the leader (a),
 * holding every other candidate at their set share.
 *
 * With batches, b's effective share s_b moves by the same amount in every pool, taken from a:
 * need = s_b + (f_a - f_b) / 2R. With one uniform pool this is (R(s_a + s_b) + v_a - v_b) / 2R.
 * Out of reach if need > s_a + s_b.
 */
export function breakEven(P, a, b) {
  if (P.R <= 0) return P.v[a] - P.v[b] > 0 ? Infinity : 0;
  return P.s[b] + (P.f[a] - P.f[b]) / (2 * P.R);
}

/**
 * Default-pool share (0–1) that gives candidate i an effective share of ALL remaining votes
 * equal to `target`, given the batches in P. Clamped to 0–1. Null when nothing is left outside
 * batches (the default split then has no effect).
 */
export function defaultShareFor(P, i, target) {
  if (!(P.rest > 0)) return null;
  const fromBatches = sum(P.pools.map(p => p.n * p.s[i]));
  return clamp((target * P.R - fromBatches) / P.rest, 0, 1);
}

/** Share percentages that mirror the count so far. */
export function sharesFromCounted(v) {
  const C = sum(v);
  return v.map(x => (C > 0 ? x / C * 100 : 100 / v.length));
}

/** Set share i to val (0–100) and rescale the others proportionally so all total 100. */
export function rebalance(shares, i, val) {
  const n = shares.length;
  val = clamp(val, 0, 100);
  const others = sum(shares.filter((_, j) => j !== i));
  const rest = 100 - val;
  return shares.map((x, j) => (j === i ? val : others > 0 ? x * rest / others : rest / (n - 1)));
}

/** Percentages rescaled to total 100. */
export const toPct = shares => normalize(shares).map(x => x * 100);

export function defaults() {
  return {
    mode: 'votes', total: 0, pctIn: 78, unc: 5, cands: [
      { name: 'Candidate A', votes: 412305, pct: 0, share: 0 },
      { name: 'Candidate B', votes: 398770, pct: 0, share: 0 }
    ],
    batches: []
  };
}

export const encodeState = state => '#s=' + encodeURIComponent(JSON.stringify(state));

/** Parse and sanitize a `#s=<json>` hash. Returns null if missing or invalid. */
export function decodeState(hash) {
  try {
    const m = String(hash || '').match(/s=([^&]+)/);
    if (!m) return null;
    const s = JSON.parse(decodeURIComponent(m[1]));
    if (!s || !Array.isArray(s.cands) || s.cands.length < MIN_CANDS) return null;
    const n = Math.min(s.cands.length, MAX_CANDS);
    return {
      mode: s.mode === 'pct' ? 'pct' : 'votes',
      total: num(s.total),
      pctIn: clamp(num(s.pctIn) || 78, 1, 100),
      unc: num(s.unc),
      cands: s.cands.slice(0, MAX_CANDS).map(c => ({
        name: String(c?.name || '').slice(0, 40), votes: num(c?.votes), pct: num(c?.pct), share: num(c?.share)
      })),
      batches: (Array.isArray(s.batches) ? s.batches : []).slice(0, MAX_BATCHES).map(b => ({
        label: String(b?.label || '').slice(0, 60), votes: num(b?.votes),
        shares: Array.from({ length: n }, (_, i) => num(b?.shares?.[i]))
      }))
    };
  } catch (e) { return null; }
}
