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
- Inputs: votes counted per candidate (or total + %), estimated % of expected vote counted, uncertainty (± pts), and each candidate's share of the *remaining* vote.
- Remaining votes `R = C / pIn - C`, where `C` is the sum of counted votes.
- Final for candidate i: `v_i + R * s_i` (shares normalized to 1).
- **Batches** (optional, max 8): known chunks of the remaining vote, `{label, votes, shares}`, each with its own split. They are carved out of the estimated `R`; the rest (`R - Σbatches`) goes at the default slider shares. If batches exceed the estimate, they become the whole remaining vote (the UI says so). `s_i` is then each candidate's *effective* share of all remaining votes.
- **Break-even** (the headline metric): the share of ALL remaining votes the current runner-up `b` needs to pass the leader `a`, holding other candidates at their set shares. General form (b gains the same amount in every pool, taken from a):
  `need = s_b + (F_a - F_b) / (2R)`, which with no batches equals `(R * (s_a + s_b) + (v_a - v_b)) / (2R)`.
  It is out of reach if `need > s_a + s_b`. The ± uncertainty on % counted is shown as a break-even range (it moves only the non-batch remainder).

## Product decisions
- Neutral palette (teal/amber/etc.), never red/blue. No partisan cues.
- A what-if calculator, not a forecast. Never phrase output as a prediction.
- Full scenario state lives in the URL hash (`#s=<json>`) for shareable links. No backend, no storage.
- Share sliders are linked so they always total 100% (moving one rescales the others proportionally).
- Mobile: sticky bottom summary bar. Desktop: two columns with a sticky result card.
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
