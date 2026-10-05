// mcdowell.dev — the multi-session console in the hero.
// Several shells take turns: a command types itself, a result animates in,
// then the next session gets the floor. No dependencies; colours come from
// CSS (the panel's `is-<colour>` class sets --c) so charts use currentColor.
//
// createConsole(root, sessions, { motion }) -> { select(id), pause(), resume(), destroy() }

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";

const el = (tag, cls, text) => {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};
const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

export function createConsole(root, sessions, { motion = true, autostart = true } = {}) {
  const tabs = Array.from(root.querySelectorAll("[role=tab]"));
  const panels = Array.from(root.querySelectorAll("[role=tabpanel]"));
  const progress = root.querySelector("[data-console-progress]");
  const byId = new Map(sessions.map((s, i) => [s.id, i]));

  let active = -1;
  let run = 0; // increments to cancel an in-flight playback
  let paused = false;
  let resumeWaiters = [];
  let holdTimer = 0;
  let destroyed = false;

  /* ---- pausable clock ------------------------------------------------------ */
  const whenResumed = () => (paused ? new Promise((r) => resumeWaiters.push(r)) : Promise.resolve());
  const sleep = async (ms, token) => {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (token !== run || destroyed) throw new Error("cancelled");
      await whenResumed();
      await new Promise((r) => setTimeout(r, Math.min(90, Math.max(0, end - performance.now()))));
    }
    if (token !== run || destroyed) throw new Error("cancelled");
  };

  /* ---- tabs ------------------------------------------------------------------ */
  function setTab(i) {
    active = i;
    tabs.forEach((t, j) => {
      const on = j === i;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      t.classList.toggle("is-active", on);
    });
    panels.forEach((p, j) => { p.hidden = j !== i; });
    root.dataset.session = sessions[i].id;
    sessions.forEach((s) => root.classList.toggle(`is-${s.colour}`, s === sessions[i]));
    if (progress) { progress.className = `console-progress is-${sessions[i].colour}`; progress.style.transform = "scaleX(0)"; }
  }
  function setProgress(frac) {
    if (!progress) return;
    progress.style.transform = `scaleX(${Math.min(1, Math.max(0, frac))})`;
  }

  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(i, true));
    t.addEventListener("keydown", (e) => {
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const j = (map[e.key] + tabs.length) % tabs.length;
      tabs[j].focus();
      select(j, true);
    });
  });

  /* ---- rendering --------------------------------------------------------------- */
  function promptLine(session) {
    const line = el("div", "t-line t-prompt");
    const p = el("span", "t-ps");
    for (const part of session.prompt) p.append(typeof part === "string" ? part : el("span", `tk-${part[0]}`, part[1]));
    const cmd = el("span", "t-cmd");
    line.append(p, " ", cmd);
    return { line, cmd };
  }

  function fillCommand(cmdEl, tokens) {
    for (const part of tokens) {
      if (typeof part === "string") cmdEl.append(part);
      else cmdEl.append(el("span", `tk-${part[0]}`, part[1]));
    }
  }

  async function typeCommand(cmdEl, tokens, token, body) {
    const caret = el("span", "t-caret");
    cmdEl.after(caret);
    for (const part of tokens) {
      const text = typeof part === "string" ? part : part[1];
      const target = typeof part === "string" ? cmdEl : el("span", `tk-${part[0]}`);
      if (target !== cmdEl) cmdEl.append(target);
      for (const ch of text) {
        target.append(ch);
        body.scrollTop = body.scrollHeight;
        const pause = ch === "\n" ? 140 : ch === "|" ? 110 : 14 + Math.random() * 22;
        await sleep(pause, token);
      }
    }
    await sleep(160, token);
    caret.remove();
  }

  async function spinner(body, token, ms) {
    const line = el("div", "t-line t-spin dim");
    const glyph = el("span", "t-glyph", SPINNER[0]);
    line.append(glyph, " running");
    body.append(line);
    const start = performance.now();
    let i = 0;
    while (performance.now() - start < ms) {
      glyph.textContent = SPINNER[i++ % SPINNER.length];
      await sleep(70, token);
    }
    line.remove();
  }

  const reveal = async (node, token, delay = 0) => {
    node.classList.add("t-in");
    if (motion) {
      await nextFrame();
      node.classList.add("t-on");
      if (delay) await sleep(delay, token);
    } else node.classList.add("t-on");
  };

  const renderers = {
    async lines(out, body, token) {
      for (const l of out.lines) {
        const line = el("div", `t-line t-out ${typeof l === "string" ? "" : l.cls || ""}`, typeof l === "string" ? l : l.text);
        body.append(line);
        await reveal(line, token, 90);
      }
    },

    async kv(out, body, token) {
      const box = el("div", "t-out t-kv");
      body.append(box);
      const width = Math.max(...out.rows.map((r) => r[0].length));
      for (const [k, v, cls] of out.rows) {
        const row = el("div", `t-kv-row ${cls ? `is-${cls}` : ""}`);
        row.append(el("span", "t-kv-k", k.padEnd(width, " ")), el("span", "t-kv-sep", " : "), el("span", "t-kv-v", v));
        box.append(row);
        body.scrollTop = body.scrollHeight;
        await reveal(row, token, 140);
      }
    },

    async table(out, body, token) {
      if (out.status) await renderers.lines({ lines: [{ text: `HTTP/1.1 ${out.status}`, cls: "ok" }] }, body, token);
      const table = el("div", `t-out t-table ${out.mono ? "is-mono" : ""}`);
      table.style.gridTemplateColumns = out.cols.map(() => "max-content").join(" ");
      body.append(table);
      const head = el("div", "t-tr t-th");
      out.cols.forEach((c) => head.append(el("span", "t-td", c)));
      table.append(head);
      await reveal(head, token, 90);
      for (const r of out.rows) {
        const row = el("div", "t-tr");
        r.forEach((c, i) => row.append(el("span", `t-td ${i === 0 ? "is-first" : ""}`, c)));
        table.append(row);
        body.scrollTop = body.scrollHeight;
        await reveal(row, token, 110);
      }
    },

    async bars(out, body, token) {
      const box = el("div", "t-out t-bars");
      body.append(box);
      const max = Math.max(...out.rows.map((r) => r[1]));
      const rows = out.rows.map(([label, value, display]) => {
        const row = el("div", "t-bar-row");
        const bar = el("span", "t-bar");
        const fill = el("i");
        bar.append(fill);
        row.append(el("span", "t-bar-k", label), bar, el("span", "t-bar-v", display ?? String(value)));
        box.append(row);
        return { row, fill, pct: (value / max) * 100 };
      });
      await nextFrame();
      for (const { row, fill, pct } of rows) {
        row.classList.add("t-in", "t-on");
        fill.style.width = `${pct}%`;
        await reveal(row, token, 110);
      }
    },

    async donut(out, body, token) {
      const box = el("div", "t-out t-donut");
      body.append(box);
      const total = out.rows.reduce((s, r) => s + r[1], 0);
      const size = 120, r = 46, c = 2 * Math.PI * r;
      const svg = svgEl("svg", { viewBox: `0 0 ${size} ${size}`, class: "t-donut-svg", "aria-hidden": "true" });
      svg.append(svgEl("circle", { cx: size / 2, cy: size / 2, r, class: "t-donut-track" }));
      let offset = 0;
      const arcs = out.rows.map(([, value], i) => {
        const len = (value / total) * c;
        const arc = svgEl("circle", { cx: size / 2, cy: size / 2, r, class: `t-arc t-arc-${i}` });
        arc.style.strokeDasharray = `0 ${c}`;
        arc.style.strokeDashoffset = String(-offset);
        offset += len;
        svg.append(arc);
        return { arc, len };
      });
      const legend = el("ul", "t-legend");
      out.rows.forEach(([label, value], i) => {
        const li = el("li", `t-legend-${i}`);
        li.append(el("i"), el("span", "t-legend-k", label), el("b", "t-legend-v", String(value)));
        legend.append(li);
      });
      box.append(svg, legend);
      await reveal(box, token);
      await nextFrame();
      arcs.forEach(({ arc, len }) => { arc.style.strokeDasharray = `${Math.max(0, len - 2)} ${c}`; });
      for (const li of legend.children) await reveal(li, token, 90);
    },

    async timeseries(out, body, token) {
      const box = el("div", "t-out t-chart");
      body.append(box);
      const W = 420, H = 150, px = 6, py = 14;
      const all = out.series.flatMap((s) => s.data);
      const max = Math.max(...all) * 1.08, min = 0;
      const n = Math.max(...out.series.map((s) => s.data.length));
      const x = (i) => px + (i / (n - 1)) * (W - px * 2);
      const y = (v) => H - py - ((v - min) / (max - min)) * (H - py * 2);
      const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, class: "t-chart-svg", preserveAspectRatio: "none", "aria-hidden": "true" });
      for (let g = 0; g <= 3; g++) {
        const gy = py + (g / 3) * (H - py * 2);
        svg.append(svgEl("line", { x1: px, x2: W - px, y1: gy, y2: gy, class: "t-grid" }));
      }
      const paths = out.series.map((s, si) => {
        const d = s.data.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
        if (si === 0) {
          const area = svgEl("path", { d: `${d} L${x(s.data.length - 1).toFixed(1)} ${H - py} L${x(0)} ${H - py} Z`, class: "t-area" });
          svg.append(area);
        }
        const path = svgEl("path", { d, class: `t-series t-series-${si}` });
        svg.append(path);
        return path;
      });
      const legend = el("ul", "t-legend t-legend-row");
      out.series.forEach((s, i) => {
        const li = el("li", `t-legend-${i}`);
        li.append(el("i"), el("span", "t-legend-k", s.name));
        legend.append(li);
      });
      const unit = el("p", "t-unit dim", out.unit || "");
      box.append(unit, svg, legend);
      await reveal(box, token);
      await nextFrame();
      paths.forEach((p) => {
        const len = p.getTotalLength();
        p.style.strokeDasharray = `${len} ${len}`;
        p.style.strokeDashoffset = String(len);
        p.getBoundingClientRect();
        p.classList.add("t-draw");
        p.style.strokeDashoffset = "0";
      });
      await sleep(motion ? 900 : 0, token);
      svg.classList.add("t-filled");
      for (const li of legend.children) await reveal(li, token, 60);
    },

    async json(out, body, token) {
      if (out.status) await renderers.lines({ lines: [{ text: `HTTP/1.1 ${out.status}`, cls: "ok" }] }, body, token);
      const box = el("div", "t-out t-json");
      body.append(box);
      const nodes = [];
      const build = (value, parent, key, depth, last) => {
        const row = el("div", "t-j-row");
        row.style.paddingLeft = `${depth * 1.25}em`;
        const isObj = value && typeof value === "object" && !Array.isArray(value);
        const isArr = Array.isArray(value);
        if (key !== undefined) row.append(el("span", "tk-prop", `"${key}"`), el("span", "tk-op", ": "));
        if (isObj || isArr) {
          const inlineArr = isArr && value.every((v) => typeof v !== "object");
          if (inlineArr) {
            row.append("[");
            value.forEach((v, i) => {
              row.append(el("span", `tk-str ${key === "builtInControls" ? "is-hot" : ""}`, `"${v}"`));
              if (i < value.length - 1) row.append(", ");
            });
            row.append(`]${last ? "" : ","}`);
            parent.append(row);
            nodes.push(row);
            return;
          }
          row.append(isArr ? "[" : "{");
          parent.append(row);
          nodes.push(row);
          const entries = isArr ? value.map((v, i) => [i, v]) : Object.entries(value);
          entries.forEach(([k, v], i) => build(v, parent, isArr ? undefined : k, depth + 1, i === entries.length - 1));
          const close = el("div", "t-j-row", `${isArr ? "]" : "}"}${last ? "" : ","}`);
          close.style.paddingLeft = `${depth * 1.25}em`;
          parent.append(close);
          nodes.push(close);
          return;
        }
        const cls = typeof value === "number" ? "tk-num" : typeof value === "boolean" ? "tk-kw" : "tk-str";
        row.append(el("span", cls, typeof value === "string" ? `"${value}"` : String(value)), last ? "" : ",");
        parent.append(row);
        nodes.push(row);
      };
      build(out.data, box, undefined, 0, true);
      for (const n of nodes) {
        body.scrollTop = body.scrollHeight;
        await reveal(n, token, 55);
      }
    },

    async progress(out, body, token) {
      for (const text of out.steps) {
        const line = el("div", "t-line t-out dim", text);
        body.append(line);
        body.scrollTop = body.scrollHeight;
        await reveal(line, token, 260);
      }
      const stat = el("div", "t-out t-stat");
      const value = el("p", "t-stat-v", motion ? "0" : out.stat.value);
      stat.append(value, el("p", "t-stat-k", out.stat.label));
      body.append(stat);
      body.scrollTop = body.scrollHeight;
      await reveal(stat, token);
      if (!motion) return;
      const target = parseInt(out.stat.value.replace(/\D/g, ""), 10) || 0;
      const suffix = out.stat.value.replace(/[\d,]/g, "");
      const t0 = performance.now(), dur = 1100;
      await new Promise((resolve) => {
        const tick = (now) => {
          if (token !== run) return resolve();
          const p = Math.min(1, (now - t0) / dur);
          const e = 1 - Math.pow(1 - p, 3);
          value.textContent = Math.round(target * e).toLocaleString("en-GB") + (p === 1 ? suffix : "");
          if (p < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
    },
  };

  const settle = (out) => ({ lines: 1300, kv: 2600, table: 2200, bars: 2200, donut: 2600, timeseries: 2600, json: 2600, progress: 2200 })[out.kind] || 2000;

  /* ---- static rendering (reduced motion, or the last frame of a session) --------- */
  async function renderComplete(i) {
    const session = sessions[i];
    const body = panels[i];
    body.replaceChildren();
    const savedMotion = motion;
    motion = false;
    try {
      for (const step of session.steps) {
        const { line, cmd } = promptLine(session);
        fillCommand(cmd, step.cmd);
        body.append(line);
        await renderers[step.output.kind](step.output, body, run);
      }
      const { line } = promptLine(session);
      line.append(el("span", "t-caret"));
      body.append(line);
    } catch (err) {
      if (err.message !== "cancelled") console.error(err);
    } finally {
      motion = savedMotion;
    }
    body.scrollTop = 0;
  }

  /* ---- playback ------------------------------------------------------------------ */
  async function play(i, token) {
    const session = sessions[i];
    const body = panels[i];
    body.replaceChildren();
    body.scrollTop = 0;
    const steps = session.steps;
    try {
      await sleep(420, token);
      for (let s = 0; s < steps.length; s++) {
        const step = steps[s];
        const { line, cmd } = promptLine(session);
        body.append(line);
        await typeCommand(cmd, step.cmd, token, body);
        await spinner(body, token, 380 + Math.min(600, step.cmd.length * 25));
        await renderers[step.output.kind](step.output, body, token);
        body.scrollTop = body.scrollHeight;
        setProgress((s + 1) / steps.length);
        await sleep(s === steps.length - 1 ? 600 : settle(step.output), token);
      }
      const { line } = promptLine(session);
      line.append(el("span", "t-caret"));
      body.append(line);
      body.scrollTop = body.scrollHeight;
      await sleep(3600, token);
      if (token === run) select((i + 1) % sessions.length, false);
    } catch (err) {
      if (err.message !== "cancelled") console.error(err);
    }
  }

  function select(i, byUser) {
    if (typeof i === "string") i = byId.get(i) ?? 0;
    if (i === active && byUser && motion) { /* restart the session from the top */ }
    run++;
    clearTimeout(holdTimer);
    setTab(i);
    if (!motion) { if (!panels[i].childElementCount) renderComplete(i); return; }
    play(i, run);
  }

  /* ---- pause when offscreen or hidden ---------------------------------------------- */
  let inView = true;
  const updatePause = () => {
    const shouldPause = !inView || document.hidden;
    if (shouldPause === paused) return;
    paused = shouldPause;
    root.classList.toggle("is-paused", paused);
    if (!paused) { const w = resumeWaiters; resumeWaiters = []; w.forEach((r) => r()); }
  };
  const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; updatePause(); }, { threshold: 0.05 });
  io.observe(root);
  document.addEventListener("visibilitychange", updatePause);

  /* ---- start ------------------------------------------------------------------------- */
  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    if (!motion) {
      panels.forEach((_, i) => renderComplete(i));
      setTab(0);
    } else {
      select(0, false);
    }
  };
  if (autostart || !motion) start();
  else { panels.forEach((p) => p.replaceChildren()); setTab(0); }

  return {
    start,
    select: (id) => { start(); select(id, true); },
    pause() { inView = false; updatePause(); },
    resume() { inView = true; updatePause(); },
    destroy() { destroyed = true; run++; io.disconnect(); document.removeEventListener("visibilitychange", updatePause); },
  };
}
