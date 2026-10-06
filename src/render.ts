// Renders the content module (public/content.js, shared with the browser) into
// the HTML sections marked with data-render="…". This runs in the Worker through
// HTMLRewriter, so the page is complete and readable before any script runs,
// and editing content.js changes both the page and the console.

import { career, links, person, sessions, stack, statement } from "../public/content.js";

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Turns `*words*` into highlighted spans. */
const accent = (s: string): string =>
  s.split(/\*([^*]+)\*/g).map((part, i) => (i % 2 ? `<em>${esc(part)}</em>` : esc(part))).join("");

function heroSub(): string {
  return `<strong>${esc(person.title)}</strong> · ${esc(person.subtitle)}`;
}

function statementText(): string {
  return accent(statement.text);
}

function statementFoot(): string {
  return statement.foot.map((p) => `<p>${esc(p)}</p>`).join("");
}

function stackBlocks(): string {
  return stack
    .map((group, i) => {
      const tools = group.tools.map((t) => `<li>${esc(t)}</li>`).join("");
      const aside = group.figure
        ? `<p class="block-figure"><b>${esc(group.figure.value)}</b><span>${esc(group.figure.label)}</span></p>`
        : `<p class="block-lead" aria-hidden="true">${esc(group.lead ?? "")}</p>`;
      const note = group.note ? `<p class="block-note">${esc(group.note)}</p>` : "";
      return `<li class="block is-${group.colour}" data-block>
        <div class="block-main">
          <p class="block-index mono">0${i + 1}</p>
          <h3 class="block-title">${esc(group.title)}</h3>
          ${note}
          <ul class="block-tools" aria-label="Tools">${tools}</ul>
        </div>
        ${aside}
      </li>`;
    })
    .join("");
}

function careerRail(): string {
  return career
    .map((employer) => {
      const name = employer.href
        ? `<a href="${esc(employer.href)}" rel="noopener">${esc(employer.employer)}</a>`
        : esc(employer.employer);
      const roles = employer.roles
        .map(
          (role) => `<li class="role" data-reveal>
            <h4 class="role-title">${esc(role.title)}</h4>
            <p class="role-text">${esc(role.text)}</p>
          </li>`,
        )
        .join("");
      const cta = employer.feature
        ? `<a class="btn btn-dark" href="${esc(employer.href ?? "/")}" rel="noopener" data-magnetic data-cursor="Visit"><span>${esc(
            (employer.href ?? "").replace(/^https?:\/\//, ""),
          )}</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg></a>`
        : "";
      return `<li class="employer is-${employer.colour} ${employer.feature ? "is-feature" : ""}" data-reveal>
        <div class="employer-head">
          <span class="employer-dot" aria-hidden="true"></span>
          <h3 class="employer-name">${name}</h3>
        </div>
        <ol class="roles">${roles}</ol>
        ${cta}
      </li>`;
    })
    .join("");
}

function contactLinks(): string {
  return links
    .map(
      (l) =>
        `<a class="btn ${l.primary ? "btn-accent" : ""}" href="${esc(l.href)}"${l.download ? " download" : ' rel="noopener"'} data-magnetic data-cursor="${esc(
          l.cursor,
        )}">${esc(l.label)}</a>`,
    )
    .join("");
}

/** The first console session, completed, for readers without JavaScript. */
function consoleFallback(): string {
  const session = sessions[0];
  if (!session) return "";
  const tokens = (parts: (string | string[])[]): string =>
    parts.map((p) => (typeof p === "string" ? esc(p) : `<span class="tk-${esc(p[0] ?? "")}">${esc(p[1] ?? "")}</span>`)).join("");
  const prompt = tokens(session.prompt);
  const blocks = session.steps.map((step) => {
    const cmd = tokens(step.cmd);
    // The output shapes are documented in content.js; only the kinds the first
    // session uses need a static rendering here.
    const out = step.output as { kind: string; lines?: (string | { text: string; cls?: string })[]; rows?: (string | number | undefined)[][] };
    const str = (v: string | number | undefined): string => (v === undefined ? "" : String(v));
    const rows = out.rows ?? [];
    let body = "";
    if (out.kind === "lines") {
      body = (out.lines ?? []).map((l) => `<div class="t-line t-out t-on ${typeof l === "string" ? "" : esc(l.cls ?? "")}">${esc(typeof l === "string" ? l : l.text)}</div>`).join("");
    } else if (out.kind === "kv") {
      const width = Math.max(...rows.map((r) => str(r[0]).length));
      body = `<div class="t-out t-kv">${rows
        .map(([k, v, cls]) => `<div class="t-kv-row t-on ${cls ? `is-${esc(str(cls))}` : ""}"><span class="t-kv-k">${esc(str(k).padEnd(width))}</span><span class="t-kv-sep"> : </span><span class="t-kv-v">${esc(str(v))}</span></div>`)
        .join("")}</div>`;
    } else if (out.kind === "bars") {
      const max = Math.max(...rows.map((r) => Number(r[1]) || 0));
      body = `<div class="t-out t-bars">${rows
        .map(([k, v, d]) => `<div class="t-bar-row t-on"><span class="t-bar-k">${esc(str(k))}</span><span class="t-bar"><i class="w-${Math.max(10, Math.ceil(((Number(v) || 0) / max) * 10) * 10)}"></i></span><span class="t-bar-v">${esc(d === undefined ? str(v) : str(d))}</span></div>`)
        .join("")}</div>`;
    }
    return `<div class="t-line t-prompt"><span class="t-ps">${prompt}</span> <span class="t-cmd">${cmd}</span></div>${body}`;
  });
  return blocks.join("");
}

export const RENDERERS: Record<string, () => string> = {
  "hero-sub": heroSub,
  statement: statementText,
  "statement-foot": statementFoot,
  stack: stackBlocks,
  career: careerRail,
  links: contactLinks,
  "console-fallback": consoleFallback,
};

/** HTMLRewriter handler: fills [data-render] elements from the content module. */
export class ContentRender {
  element(el: Element): void {
    const key = el.getAttribute("data-render");
    const render = key ? RENDERERS[key] : undefined;
    if (render) el.setInnerContent(render(), { html: true });
  }
}
