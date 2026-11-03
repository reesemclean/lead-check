# Lead Check

Election-night what-if calculator: "Is that lead big enough given the % counted?"
Static single-page app (`index.html`, no build step), deployed to Cloudflare Pages.

## Core model
- Inputs: votes counted per candidate (or total + %), estimated % of expected vote counted, uncertainty (± pts), and each candidate's share of the *remaining* vote.
- Remaining votes `R = C / pIn - C`, where `C` is the sum of counted votes.
- Final for candidate i: `v_i + R * s_i` (shares normalized to 1).
- **Break-even** (the headline metric): the share of ALL remaining votes the current runner-up `b` needs to pass the leader `a`, holding other candidates at their set shares:
  `need = (R * (s_a + s_b) + (v_a - v_b)) / (2R)`.
  It is out of reach if `need > s_a + s_b`. The ± uncertainty on % counted is shown as a break-even range.

## Product decisions
- Neutral palette (teal/amber/etc.), never red/blue. No partisan cues.
- A what-if calculator, not a forecast. Never phrase output as a prediction.
- Full scenario state lives in the URL hash (`#s=<json>`) for shareable links. No backend, no storage.
- Share sliders are linked so they always total 100% (moving one rescales the others proportionally).
- Mobile: sticky bottom summary bar. Desktop: two columns with a sticky result card.
- Max 6 candidates; minimum 2.

## Next up
1. **Remaining vote by batch**: rows of `{label, est. votes, expected margin or shares}` (e.g. "Maricopa late mail, ~120k, B +8") that replace the single uniform remaining pool. This is the most realistic model.
2. Extract the math into `lead.js` with unit tests (Vitest), including the break-even identity: at `need`, the finals for a and b are equal.
3. OG/meta image so shared links preview well.
4. Optional: Workers static assets via `wrangler.toml` instead of Pages.

## Deploy
```
npx wrangler pages deploy . --project-name=lead-check
```
