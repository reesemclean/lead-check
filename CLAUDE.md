# Lead Check

Election-night what-if calculator: "Is that lead big enough given the % counted?"
Static single-page app (`public/index.html`, no build step), deployed to Cloudflare Pages.

## Files
- `public/`: everything that gets deployed, and nothing else.
  - `index.html`: markup, styles and UI code (`<script type="module">`).
  - `lead.js`: pure math and URL-state helpers, no DOM. All model changes go here, with tests.
- `test/lead.test.js`: Vitest. Run `npm test`.

## Local dev
`index.html` imports `lead.js` as an ES module, so it must be served over HTTP (opening the file directly won't work):
`npm run dev` (or `python3 -m http.server -d public`).

## Core model
- Inputs: votes counted per candidate (or total + %), estimated % of expected vote counted, and each candidate's share of the *remaining* vote.
- Remaining votes `R = C / pIn - C`, where `C` is the sum of counted votes.
- Final for candidate i: `v_i + R * s_i` (shares normalized to 1).
- **Batches** (optional, max 8; collapsed by default in step 2, auto-opened when a link has batches): known chunks of the remaining vote, `{label, votes, shares}`, each with its own split. They are carved out of the estimated `R`; the rest (`R - Σbatches`) goes at the default slider shares. If batches exceed the estimate, they become the whole remaining vote (the UI says so). `s_i` is then each candidate's *effective* share of all remaining votes.
- **Break-even** (the headline metric): the share of ALL remaining votes the current runner-up `b` needs to pass the leader `a`, holding other candidates at their set shares. General form (b gains the same amount in every pool, taken from a):
  `need = s_b + (F_a - F_b) / (2R)`, which with no batches equals `(R * (s_a + s_b) + (v_a - v_b)) / (2R)`.
  It is out of reach if `need > s_a + s_b`. The break-even is also shown as a range assuming % counted could be off by ±3 points (`DEFAULT_UNC` in `lead.js`). Experts can change it (Exact/±2/±3/±5/±10) in a collapsed "Advanced" section at the bottom; a non-default choice is saved in the URL. It moves only the non-batch remainder.

## Product decisions
- Neutral palette (teal/amber/etc.), never red/blue. No partisan cues.
- A what-if calculator, not a forecast. Never phrase output as a prediction.
- Full scenario state lives in the URL hash (`#s=<json>`) for shareable links. No backend, no storage.
- The scenario card is meant for a quick read: headline, one "needs X%" sentence, then the per-candidate share sliders right under it, then a compact display-only meter (needs / so far markers, ±range band) and the range sentence. Sliders are linked so they always total 100% (moving one rescales the others proportionally). With batches, the sliders set the non-batch remainder. No legend, axis or draggable pin: keep the card short.
- Progressive disclosure: everyday controls up front; known batches and the uncertainty setting are collapsed.
- Mobile: single column, no floating summary bars (a bottom bar clashed with iOS Safari's toolbar; a top one felt erratic). Desktop: two columns with a sticky scenario card.
- Max 6 candidates; minimum 2.

## Next up
1. OG/meta image so shared links preview well.
2. Batches: optional margin entry ("B +8") as an alternative to typing each split. The split inputs show the lean today.

## Deploy
Cloudflare Pages project `enough`, Git-connected to `reesemclean/lead-check`.
- Every push to `main` deploys to production: https://enough.jibble.dev (fallback: https://enough-41u.pages.dev)
- `jibble.dev` is the owner's playground domain (Cloudflare Registrar, auto-renew on, renews yearly around Nov 3). Each project gets its own subdomain: a Pages custom domain plus a proxied CNAME `<name>` → `<project>.pages.dev` in the `jibble.dev` zone.
- Pushes to other branches and PRs get preview URLs.
- Build settings: no build command, output directory `public`. Only `public/` is served.
- Manual fallback: `npx wrangler pages deploy public --project-name=enough`
