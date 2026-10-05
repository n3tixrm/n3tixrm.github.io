# mcdowell.dev

The personal site of Ryan McDowell: Microsoft 365 specialist, Modern Workplace architect and founder of [Netix Digital](https://netix.digital).

It runs entirely on [Cloudflare Workers](https://developers.cloudflare.com/workers/). The pages are static files served with [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), and a small Worker sits in front of them.

## What the Worker does

| Route | Behaviour |
| --- | --- |
| every response | Adds a strict Content-Security-Policy, HSTS, `nosniff`, frame denial, a referrer policy and a permissions policy, plus per-type `Cache-Control` |
| HTML pages | Stamps request-time details into `[data-edge]` elements with `HTMLRewriter`: the Cloudflare location that served the page, the current year, and the missing path on the 404 page |
| `/linkedin`, `/in`, `/github`, `/gh`, `/netix` | Short links (302) |
| `/vcard`, `/ryan-mcdowell.vcf` | Generated vCard 4.0 contact card |
| `www.mcdowell.dev/*` | 301 to the apex domain |
| anything not found | `public/404.html` with a 404 status |
| non-GET/HEAD | 405 |

Links and contact-card details live in [`src/site.ts`](src/site.ts).

## Project layout

```
public/            static site, deployed as-is
  index.html       the page
  styles.css       design tokens, light and dark themes, layout
  app.js           progressive enhancement: KQL console, ⌘K palette, theme toggle
  theme.js         applies a saved theme before first paint
  404.html
  fonts/           self-hosted Instrument Serif, Geist, Geist Mono (OFL)
  og.png           social preview, rendered from scripts/og.html
src/               the Worker
test/              Worker tests, run inside workerd via @cloudflare/vitest-pool-workers
scripts/           source and renderer for og.png and apple-touch-icon.png
wrangler.jsonc     Worker config, assets binding, custom domains
```

The site has no build step and no client framework. Everything loads from its own origin, so the CSP can stay at `'self'`.

## Develop

```sh
npm install
npm run dev        # http://localhost:8787
npm run check      # type-check
npm test           # Worker tests in the Workers runtime
npm run og         # re-render og.png and the touch icon (needs Chrome; set CHROME=/path if needed)
```

## Deploy

Pushes to `main` run CI (type-check, tests, a dry-run bundle). The workflow then deploys with `wrangler deploy` if these repository secrets are set:

- `CLOUDFLARE_API_TOKEN`: an API token with the **Edit Cloudflare Workers** template permissions, scoped to the `mcdowell.dev` zone
- `CLOUDFLARE_ACCOUNT_ID`

Without them, the deploy job is skipped and leaves a notice. To deploy by hand, run `npx wrangler login && npm run deploy`.

### Moving mcdowell.dev from GitHub Pages

`wrangler.jsonc` attaches `mcdowell.dev` and `www.mcdowell.dev` as Worker [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Cloudflare creates the DNS records and certificates on deploy. That requires:

1. The `mcdowell.dev` zone is active on the same Cloudflare account.
2. The existing GitHub Pages `A`/`CNAME` records for `mcdowell.dev` and `www` are deleted, because custom domains can't take over a hostname that already has a record.
3. GitHub Pages is turned off for this repository (**Settings → Pages**), so it stops serving the old site.

Until then, the Worker is still reachable on its `*.workers.dev` URL.

## Licence

Code is MIT (see [LICENSE](LICENSE)). Fonts are under the SIL Open Font License; see [`public/fonts/OFL.txt`](public/fonts/OFL.txt).
