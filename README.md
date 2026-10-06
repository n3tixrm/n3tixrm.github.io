# mcdowell.dev

The personal site of Ryan McDowell: Microsoft 365 specialist, Modern Workplace Architect and founder of [Netix Digital](https://netix.digital).

It runs entirely on [Cloudflare Workers](https://developers.cloudflare.com/workers/). The pages are static files served with [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/), and a small Worker sits in front of them.

## What the Worker does

| Route | Behaviour |
| --- | --- |
| every response | Adds a strict Content-Security-Policy, HSTS, `nosniff`, frame denial, a referrer policy and a permissions policy, plus per-type `Cache-Control` |
| HTML pages | Renders the content module into `[data-render]` sections and stamps request-time details into `[data-edge]` elements with `HTMLRewriter`: the Cloudflare location that served the page, the current year, and the missing path on the 404 page |
| `/linkedin`, `/in`, `/github`, `/gh`, `/netix` | Short links (302) |
| `/vcard`, `/ryan-mcdowell.vcf` | Generated vCard 4.0 contact card |
| `www.mcdowell.dev/*` | 301 to the apex domain |
| anything not found | `public/404.html` with a 404 status |
| non-GET/HEAD | 405 |

Links and contact-card details live in [`src/site.ts`](src/site.ts).

## Editing the words

Everything the page says is in **[`public/content.js`](public/content.js)**: name and title, the statement, the tool stack (five colour-coded groups), the career path (grouped by employer, no dates), the links, the connect sequence, the command palette and the five console sessions in the hero. Edit that one file to change content; nothing in the styles or scripts needs to change.

The same module is used twice:

- The Worker imports it ([`src/render.ts`](src/render.ts)) and renders the stack, career path, statement, links and a completed first console session into the HTML on every request, so the page is complete and readable before any script runs (and for readers without JavaScript).
- The browser imports it for the live console (`public/console.js`), the connect sequence and the command palette.

A console session is a chip colour, a prompt and a list of steps; each step is a command (an array of plain strings and `[tokenClass, text]` pairs for syntax highlighting) and an output (`lines`, `kv`, `table`, `bars`, `donut`, `timeseries`, `json` or `progress`). The output kinds are documented at the top of the sessions in `content.js`. Keep sample numbers obviously small; the only real figure on the site is the 35,000+ managed ChromeOS devices.

## The front end

A deep green-black canvas with five flat category colours (blue, mint, yellow, purple, red), always with dark text on colour. Each colour means one thing across the site: a console session, a stack group, a career employer, a section label.

- **Hero:** a multi-session console. Five shells (`pwsh`, `kql`, `gam`, `graph`, `metrics`) take turns: a command types itself, the result animates in (Format-List, tables, bars, a donut, timecharts, a JSON tree, a counter), then the next session gets the floor. Tabs are a proper `tablist` (click or arrow keys) and the results introduce Ryan.
- **Statement:** pinned, with a word-by-word scrub reveal; highlighted words in mint.
- **Stack:** five filled blocks in descending widths, scroll-driven reveal with a slight tilt on hover.
- **Career path:** employer-grouped rail with a drawn line; Netix Digital is the feature block.
- **Contact:** a giant "Open to consulting." reveal and magnetic buttons.
- Also: a short, skippable connect sequence on the first visit of a session, a scroll progress rail, a ⌘K / Ctrl K / `/` command palette (which can also run a console session), a custom cursor on fine pointers, and a Conditional Access-styled 404.

It is plain HTML, CSS and JavaScript with two vendored libraries (GSAP and Lenis); there is no build step.

- `prefers-reduced-motion` (or the footer's **Motion** toggle, stored in `localStorage`) turns off the connect sequence, smooth scrolling, scroll choreography, the cursor and all looping animation. The console shows every session completed; tabs still switch between them.
- Everything reads without JavaScript; JS only adds motion and the palette.
- The console pauses when it is off screen or the tab is hidden, and the connect overlay has a timeout so it can never trap the page.

## Project layout

```
public/            static site, deployed as-is
  index.html       the page (sections marked data-render are filled by the Worker)
  404.html         "Access blocked": a Conditional Access-style not-found page
  content.js       ALL the words: person, statement, stack, career, links, boot lines, palette, console sessions
  console.js       the multi-session console engine (typing, renderers, charts, tabs)
  styles.css       design tokens, layout, section styles, reduced-motion rules
  boot.js          runs before first paint: motion preference and connect-overlay flag
  app.js           choreography: connect sequence, hero intro, GSAP/ScrollTrigger scenes, palette, cursor
  vendor/          GSAP 3.15 (core, ScrollTrigger, SplitText) and Lenis 1.3, see vendor/LICENSES.md
  fonts/           self-hosted Inter Tight, Geist, Geist Mono (OFL)
  og.png           social preview, rendered from scripts/og.html
src/               the Worker (index.ts routes, render.ts content rendering, site.ts links and vCard)
test/              Worker tests, run inside workerd via @cloudflare/vitest-pool-workers
scripts/           source and renderer for og.png and apple-touch-icon.png
wrangler.jsonc     Worker config, assets binding, custom domains, preview environment
```

Everything loads from its own origin, so the CSP stays at `'self'` with no inline scripts or styles (the tests check this). Fonts and the versioned vendor files are served with a one-year immutable cache.

## Develop

```sh
npm install
npm run dev        # http://localhost:8787
npm run check      # type-check (includes public/content.js)
npm test           # Worker tests in the Workers runtime
npm run og         # re-render og.png and the touch icon (needs Chrome; set CHROME=/path if needed)
```

## Deploy

Pushes to `main` run CI (type-check, tests, a dry-run bundle). The workflow then deploys with `wrangler deploy` if these repository secrets are set:

- `CLOUDFLARE_API_TOKEN`: an API token with the **Edit Cloudflare Workers** template permissions, scoped to the `mcdowell.dev` zone
- `CLOUDFLARE_ACCOUNT_ID`

Without them, the deploy job is skipped and leaves a notice. To deploy by hand, run `npx wrangler login && npm run deploy`. `npm run deploy:preview` publishes a routeless copy on `*.workers.dev` for checking before DNS moves.

### Moving mcdowell.dev from GitHub Pages

`wrangler.jsonc` attaches `mcdowell.dev` and `www.mcdowell.dev` as Worker [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/). Cloudflare creates the DNS records and certificates on deploy. That requires:

1. The `mcdowell.dev` zone is active on the same Cloudflare account.
2. The existing GitHub Pages `A`/`CNAME` records for `mcdowell.dev` and `www` are deleted, because custom domains can't take over a hostname that already has a record.
3. GitHub Pages is turned off for this repository (**Settings → Pages**), so it stops serving the old site.

Until then, the Worker is still reachable on its `*.workers.dev` URL.

## Licence

Code is MIT (see [LICENSE](LICENSE)). Fonts are under the SIL Open Font License; see [`public/fonts/OFL.txt`](public/fonts/OFL.txt). Vendored libraries keep their own licences; see [`public/vendor/LICENSES.md`](public/vendor/LICENSES.md).
