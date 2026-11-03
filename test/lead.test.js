import { describe, it, expect } from 'vitest';
import {
  num, normalize, counted, remaining, project, breakEven, rank,
  sharesFromCounted, rebalance, toPct, defaults, encodeState, decodeState, sum
} from '../lead.js';

const close = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('num', () => {
  it('parses formatted numbers', () => {
    expect(num('412,305')).toBe(412305);
    expect(num('48.5%')).toBe(48.5);
    expect(num('')).toBe(0);
    expect(num('abc')).toBe(0);
  });
});

describe('normalize', () => {
  it('scales to 1 and treats negatives as 0', () => {
    expect(normalize([1, 3])).toEqual([0.25, 0.75]);
    expect(normalize([-5, 2])).toEqual([0, 1]);
  });
  it('splits evenly when all zero', () => {
    expect(normalize([0, 0, 0, 0])).toEqual([0.25, 0.25, 0.25, 0.25]);
  });
});

describe('counted', () => {
  it('reads votes mode', () => {
    expect(counted({ mode: 'votes', cands: [{ votes: 10 }, { votes: -3 }] })).toEqual([10, 0]);
  });
  it('derives votes from total and percentages', () => {
    expect(counted({ mode: 'pct', total: 1000, cands: [{ pct: 52 }, { pct: 48 }] })).toEqual([520, 480]);
  });
});

describe('remaining', () => {
  it('is C/p - C', () => {
    close(remaining(800, 80), 200);
    close(remaining(500, 50), 500);
  });
  it('is zero when fully counted', () => {
    expect(remaining(1000, 100)).toBe(0);
  });
});

describe('project', () => {
  it('adds the remaining vote by share', () => {
    const P = project({ v: [600, 400], pIn: 50, shares: [40, 60] });
    expect(P.C).toBe(1000);
    close(P.R, 1000);
    close(P.T, 2000);
    close(P.f[0], 1000);
    close(P.f[1], 1000);
    close(sum(P.f), P.T);
  });
});

describe('breakEven', () => {
  // Shift `need - s_b` of the remaining vote from a to b and check they tie.
  const finalsAt = (P, a, b, need) => {
    const sb = need, sa = P.s[a] + P.s[b] - need;
    return [P.v[a] + P.R * sa, P.v[b] + P.R * sb];
  };

  it('matches the closed form for two candidates', () => {
    const P = project({ v: [412305, 398770], pIn: 78, shares: [50, 50] });
    const need = breakEven(P, 0, 1);
    close(need, (P.R * 1 + (412305 - 398770)) / (2 * P.R));
  });

  const cases = [
    { v: [412305, 398770], pIn: 78, shares: [50.8, 49.2] },
    { v: [5000, 4000, 1000], pIn: 60, shares: [45, 45, 10] },
    { v: [300, 290, 200, 10], pIn: 30, shares: [10, 20, 30, 40] },
    { v: [1000, 999], pIn: 99, shares: [70, 30] },
  ];
  it.each(cases)('identity: at need, finals for a and b are equal ($v)', c => {
    const P = project(c);
    const [a, b] = rank(P.v);
    const need = breakEven(P, a, b);
    const [fa, fb] = finalsAt(P, a, b, need);
    close(fa, fb, 1e-6 * P.T);
  });

  it('a slightly higher share flips the result; slightly lower does not', () => {
    const P = project({ v: [5000, 4000, 1000], pIn: 60, shares: [45, 45, 10] });
    const need = breakEven(P, 0, 1);
    const [aHi, bHi] = finalsAt(P, 0, 1, need + 0.001);
    const [aLo, bLo] = finalsAt(P, 0, 1, need - 0.001);
    expect(bHi).toBeGreaterThan(aHi);
    expect(bLo).toBeLessThan(aLo);
  });

  it('is out of reach when need exceeds the share not going to others', () => {
    const P = project({ v: [6000, 2000, 0], pIn: 80, shares: [10, 10, 80] });
    expect(breakEven(P, 0, 1)).toBeGreaterThan(P.s[0] + P.s[1]);
  });

  it('is Infinity with nothing left and a real lead, 0 when tied', () => {
    expect(breakEven(project({ v: [10, 9], pIn: 100, shares: [1, 1] }), 0, 1)).toBe(Infinity);
    expect(breakEven(project({ v: [10, 10], pIn: 100, shares: [1, 1] }), 0, 1)).toBe(0);
  });

  it('falls as more vote is left (lower % counted)', () => {
    const at = pIn => breakEven(project({ v: [520, 480], pIn, shares: [1, 1] }), 0, 1);
    expect(at(60)).toBeLessThan(at(80));
  });
});

describe('shares helpers', () => {
  it('sharesFromCounted mirrors the count', () => {
    expect(sharesFromCounted([300, 100])).toEqual([75, 25]);
    expect(sharesFromCounted([0, 0])).toEqual([50, 50]);
  });
  it('rebalance keeps the total at 100 and others proportional', () => {
    const r = rebalance([50, 30, 20], 0, 80);
    close(sum(r), 100);
    expect(r[0]).toBe(80);
    close(r[1] / r[2], 30 / 20);
  });
  it('rebalance splits evenly when others are all zero', () => {
    expect(rebalance([100, 0, 0], 0, 40)).toEqual([40, 30, 30]);
  });
  it('toPct rescales to 100', () => {
    expect(toPct([1, 1, 2])).toEqual([25, 25, 50]);
  });
});

describe('URL state', () => {
  it('round-trips', () => {
    const s = defaults();
    expect(decodeState(encodeState(s))).toEqual(s);
  });
  it('rejects junk', () => {
    expect(decodeState('')).toBeNull();
    expect(decodeState('#s=notjson')).toBeNull();
    expect(decodeState('#s=' + encodeURIComponent('{"cands":[{}]}'))).toBeNull();
  });
  it('sanitizes and caps candidates', () => {
    const raw = { mode: 'weird', pctIn: 500, cands: Array.from({ length: 9 }, (_, i) => ({ name: 'x'.repeat(99), votes: '1,000' })) };
    const s = decodeState(encodeState(raw));
    expect(s.mode).toBe('votes');
    expect(s.pctIn).toBe(100);
    expect(s.cands).toHaveLength(6);
    expect(s.cands[0].name).toHaveLength(40);
    expect(s.cands[0].votes).toBe(1000);
  });
});

describe('batches', () => {
  const v = [52000, 48000];
  const base = { v, pIn: 80, shares: [50, 50] }; // 25,000 remaining

  it('carve out of the estimate; the rest goes at the default split', () => {
    const P = project({ ...base, batches: [{ label: 'Late mail', votes: 10000, shares: [40, 60] }] });
    close(P.est, 25000);
    close(P.B, 10000);
    close(P.rest, 15000);
    close(P.R, 25000);
    close(P.add[0], 4000 + 7500);
    close(P.add[1], 6000 + 7500);
    close(sum(P.s), 1);
    expect(P.over).toBe(false);
  });

  it('replace the estimate when they add up to more', () => {
    const P = project({ ...base, batches: [{ votes: 20000, shares: [30, 70] }, { votes: 10000, shares: [50, 50] }] });
    expect(P.over).toBe(true);
    expect(P.rest).toBe(0);
    close(P.R, 30000);
    close(P.f[0], 52000 + 6000 + 5000);
    close(P.f[1], 48000 + 14000 + 5000);
  });

  it('ignore empty batches and are the same as no batches when they match the default split', () => {
    const plain = project(base);
    const P = project({ ...base, batches: [{ votes: 0, shares: [0, 100] }, { votes: 5000, shares: [50, 50] }] });
    expect(P.pools).toHaveLength(1);
    P.f.forEach((x, i) => close(x, plain.f[i]));
  });

  it('pad short share arrays and normalize', () => {
    const P = project({ v: [10, 10, 10], pIn: 50, shares: [1, 1, 1], batches: [{ votes: 30, shares: [2, 2] }] });
    close(P.add[0], 15);
    close(P.add[2], 0);
  });

  it('break-even identity holds with uneven batches', () => {
    const cases = [
      { ...base, batches: [{ votes: 10000, shares: [40, 60] }] },
      { ...base, batches: [{ votes: 12000, shares: [65, 35] }, { votes: 8000, shares: [20, 80] }] },
      { v: [5000, 4000, 1000], pIn: 60, shares: [45, 45, 10], batches: [{ votes: 2000, shares: [30, 50, 20] }] },
      { ...base, batches: [{ votes: 40000, shares: [45, 55] }] }, // over the estimate
    ];
    for (const c of cases) {
      const P = project(c);
      const [a, b] = rank(P.v);
      const need = breakEven(P, a, b);
      // b's share of every pool rises by d, a's falls by d.
      const d = need - P.s[b];
      close(P.f[a] - d * P.R, P.f[b] + d * P.R, 1e-6 * P.T);
    }
  });

  it('a batch leaning to the runner-up lowers what they need from everything else', () => {
    const plain = breakEven(project(base), 0, 1);
    const P = project({ ...base, batches: [{ votes: 10000, shares: [40, 60] }] });
    // Same overall bar for all remaining votes, but the scenario pin (s_b) is now closer to it.
    close(breakEven(P, 0, 1), plain);
    expect(P.s[1]).toBeGreaterThan(0.5);
  });

  it('URL state keeps batches and aligns shares to candidates', () => {
    const s = { ...defaults(), batches: [{ label: 'Mail', votes: '120,000', shares: [46, 54, 99] }] };
    const d = decodeState(encodeState(s));
    expect(d.batches).toEqual([{ label: 'Mail', votes: 120000, shares: [46, 54] }]);
    expect(decodeState(encodeState({ cands: defaults().cands })).batches).toEqual([]);
  });
});
