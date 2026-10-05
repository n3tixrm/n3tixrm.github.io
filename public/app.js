// mcdowell.dev — choreography layer. Everything here is progressive
// enhancement: the document reads fine without it.
import { start as startField } from "/field.js";

const root = document.documentElement;
const q = (sel, el = document) => el.querySelector(sel);
const qa = (sel, el = document) => Array.from(el.querySelectorAll(sel));
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const motion = !root.classList.contains("reduce");
const hasGsap = typeof gsap !== "undefined" && typeof ScrollTrigger !== "undefined";
if (hasGsap) gsap.registerPlugin(ScrollTrigger, ...(typeof SplitText !== "undefined" ? [SplitText] : []));

/* ---- Toast ----------------------------------------------------------------- */
const toastEl = q(".toast");
let toastTimer;
function toast(message) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("on"), 2200);
}

/* ---- Motion preference ------------------------------------------------------ */
qa("[data-motion-state]").forEach((el) => (el.textContent = motion ? "on" : "off"));
function setMotion(on) {
  try { localStorage.setItem("motion", on ? "on" : "off"); } catch {}
  try { sessionStorage.setItem("booted", "1"); } catch {}
  toast(on ? "Motion on" : "Motion off");
  setTimeout(() => location.reload(), 350);
}
qa("[data-motion-toggle]").forEach((b) => b.addEventListener("click", () => setMotion(!motion)));
if (!motion) root.classList.add("motion-off"); else root.classList.add("motion-on");

/* ---- HUD: clock, uptime, scroll progress ----------------------------------- */
{
  const clock = q("[data-clock]");
  const up = q("[data-uptime]");
  const pad = (n) => String(n).padStart(2, "0");
  const t0 = Date.now();
  const tick = () => {
    const d = new Date();
    if (clock) clock.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    if (up) {
      const s = Math.floor((Date.now() - t0) / 1000);
      up.textContent = `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
    }
  };
  tick();
  setInterval(tick, 1000);
}

/* ---- Smooth scroll (Lenis) --------------------------------------------------- */
let lenis = null;
if (motion && hasGsap && typeof Lenis !== "undefined" && finePointer) {
  lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1, smoothWheel: true });
  lenis.on("scroll", ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
function scrollToTarget(target) {
  const el = typeof target === "string" ? q(target) : target;
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: el.id === "top" ? 0 : -24, duration: 1.4 });
  else el.scrollIntoView({ behavior: motion ? "smooth" : "auto", block: "start" });
}
qa('a[href^="#"]').forEach((a) => {
  a.addEventListener("click", (e) => {
    const id = a.getAttribute("href");
    if (!id || id === "#" || !q(id)) return;
    e.preventDefault();
    scrollToTarget(id);
    history.replaceState(null, "", id);
  });
});

/* ---- Hero field (WebGL) ------------------------------------------------------- */
let field = null;
{
  const canvas = q("#field");
  if (canvas) {
    try { field = startField(canvas, { motion }); } catch (err) { console.warn("Field disabled:", err.message); }
    if (!field) canvas.remove();
  }
}

/* ---- Scramble text --------------------------------------------------------------- */
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/_\\|[]{}";
function scramble(el, { duration = 1.1, delay = 0 } = {}) {
  const finalText = el.dataset.text || el.textContent;
  el.dataset.text = finalText;
  const n = finalText.length;
  let start = 0;
  return new Promise((resolve) => {
    const frame = (now) => {
      if (!start) start = now;
      const t = (now - start) / 1000 - delay;
      if (t < 0) return requestAnimationFrame(frame);
      const prog = Math.min(1, t / duration);
      let out = "";
      for (let i = 0; i < n; i++) {
        const ch = finalText[i];
        if (ch === " ") { out += " "; continue; }
        const local = prog * 1.6 - (i / n) * 0.6;
        out += local >= 1 ? ch : local < 0.15 ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (prog < 1) requestAnimationFrame(frame); else { el.textContent = finalText; resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

/* ---- Boot sequence ------------------------------------------------------------ */
const BOOT_LINES = [
  ["auth", "verifying identity", "ok"],
  ["policy", "conditional access evaluated", "grant"],
  ["device", "compliance check", "ok"],
  ["edge", () => `serving from ${q('[data-edge="colo"]')?.textContent?.trim() || "the edge"}`, "ok"],
  ["render", "mcdowell.dev", "ready"],
];

function runBoot() {
  return new Promise((resolve) => {
    const boot = q("#boot");
    const list = q("#boot-lines");
    const bar = q(".boot-bar span");
    if (!boot || !list || !root.classList.contains("is-booting")) { root.classList.remove("is-booting"); return resolve(false); }

    list.innerHTML = "";
    const items = BOOT_LINES.map(([k, msg, status]) => {
      const li = document.createElement("li");
      const m = typeof msg === "function" ? msg() : msg;
      li.innerHTML = `<span class="k">${k.padEnd(7, " ")}</span> ${m} <span class="ok">· ${status}</span>`;
      list.append(li);
      return li;
    });

    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { sessionStorage.setItem("booted", "1"); } catch {}
      window.removeEventListener("keydown", finish);
      boot.removeEventListener("click", finish);
      const out = () => { root.classList.remove("is-booting"); resolve(true); };
      if (hasGsap) gsap.to(boot, { yPercent: -100, duration: 0.7, ease: "power4.inOut", onComplete: () => { out(); gsap.set(boot, { clearProps: "all" }); } });
      else out();
    };
    window.addEventListener("keydown", finish);
    boot.addEventListener("click", finish);

    const step = 0.26;
    items.forEach((li, i) => setTimeout(() => li.classList.add("on"), 120 + i * step * 1000));
    if (hasGsap) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: items.length * step + 0.3, ease: "power2.inOut" });
    setTimeout(finish, items.length * step * 1000 + 650);
  });
}

/* ---- Hero intro --------------------------------------------------------------- */
const heroTitle = q("#hero-title");
const scrambleEls = qa("[data-scramble]");
const heroBits = [q(".hero-kicker"), q(".hero-meta"), q(".hero-hud")].filter(Boolean);

const hasHero = Boolean(heroTitle) && scrambleEls.length > 0;
if (motion && hasGsap && hasHero) {
  gsap.set(scrambleEls, { yPercent: 110 });
  gsap.set(heroBits, { opacity: 0, y: 24 });
  heroTitle.setAttribute("aria-label", "Ryan McDowell");
}
root.classList.remove("pending");

async function heroIntro() {
  if (!(motion && hasGsap && hasHero)) return;
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(scrambleEls, { yPercent: 0, duration: 1.1, stagger: 0.12 }, 0.05)
    .to(heroBits, { opacity: 1, y: 0, duration: 1, stagger: 0.12 }, 0.6);
  scrambleEls.forEach((el, i) => scramble(el, { duration: 1.0, delay: 0.15 + i * 0.14 }));
  await tl.then();
  heroTitle?.removeAttribute("aria-label");
}

/* ---- Scroll choreography -------------------------------------------------------- */
function setupScroll() {
  if (!hasGsap) return;
  const mm = gsap.matchMedia();

  // Scroll progress rail and active nav.
  if (q(".progress span")) gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.4 } });
  qa("[data-nav]").forEach((link) => {
    const section = q(link.getAttribute("href"));
    if (!section) return;
    ScrollTrigger.create({ trigger: section, start: "top 50%", end: "bottom 50%", onToggle: (self) => link.classList.toggle("is-active", self.isActive) });
  });

  if (!motion) return;

  // Hero: parallax out, hand scroll progress to the shader.
  const hero = q(".hero");
  if (hero) gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true, onUpdate: (self) => field?.setScroll(self.progress) } })
    .to(".hero-inner", { y: 160, opacity: 0, ease: "none" }, 0)
    .to(".hero-hud", { opacity: 0, ease: "none" }, 0);

  // Statement: pinned, words light up as you scroll.
  const statement = q("[data-words]");
  if (statement) {
    const words = statement.textContent.trim().split(/\s+/);
    const phrase = ["secure", "by", "design:"];
    const hotStart = words.findIndex((_, i) => phrase.every((w, j) => words[i + j] === w));
    const hotIndex = new Set(hotStart < 0 ? [] : phrase.map((_, j) => hotStart + j));
    statement.textContent = "";
    const spans = words.map((w, i) => {
      const s = document.createElement("span");
      s.className = "w";
      s.textContent = w;
      if (hotIndex.has(i)) s.dataset.hot = "";
      statement.append(s, " ");
      return s;
    });
    const ink = getComputedStyle(root).getPropertyValue("--ink").trim();
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".statement", start: "top top", end: "+=140%", pin: true, scrub: 0.5, anticipatePin: 1 } });
    tl.fromTo(".statement .section-label", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);
    spans.forEach((s, i) => tl.to(s, { color: "hot" in s.dataset ? accent : ink, duration: 0.6 }, 0.3 + i * 0.22));
    tl.fromTo(".statement-foot", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2 }, ">-0.4");
    tl.to({}, { duration: 1 });
  }

  // Line reveals for section titles.
  const splitTargets = qa("[data-lines]");
  if (typeof SplitText !== "undefined") {
    splitTargets.forEach((el) => {
      SplitText.create(el, {
        type: "lines", mask: "lines", linesClass: "sl", autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
      });
    });
  }

  // Generic reveals.
  qa("[data-reveal]").forEach((el) => {
    gsap.from(el, { opacity: 0, y: 40, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%", once: true } });
  });
  qa(".statement-foot, .netix-text, .contact-text, .contact-links, .panel-body").forEach((el) => {
    if (el.closest(".statement")) return;
    gsap.from(el, { opacity: 0, y: 32, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%", once: true } });
  });

  // Practice: horizontal scroll on wide screens, stacked reveals otherwise.
  const track = q("[data-track]");
  if (!track) return;
  const panels = qa("[data-panel]");
  const counter = q("[data-panel-index]");
  mm.add("(min-width: 1024px)", () => {
    const gutter = () => parseFloat(getComputedStyle(root).getPropertyValue("--gutter")) || 24;
    const distance = () => {
      const last = panels[panels.length - 1];
      const width = last.getBoundingClientRect().right - track.getBoundingClientRect().left;
      return Math.max(0, width + gutter() - window.innerWidth);
    };
    const tween = gsap.to(track, {
      x: () => -distance(), ease: "none",
      scrollTrigger: {
        trigger: ".practice", start: "top top", end: () => `+=${distance() + window.innerHeight * 0.5}`,
        pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        onUpdate: (self) => { if (counter) counter.textContent = String(Math.min(panels.length, 1 + Math.round(self.progress * (panels.length - 1)))).padStart(2, "0"); },
      },
    });
    panels.forEach((panel) => {
      gsap.fromTo(panel, { opacity: 0.25, scale: 0.92, rotateY: 6 }, { opacity: 1, scale: 1, rotateY: 0, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left 95%", end: "left 45%", scrub: true } });
      const visual = q(".panel-visual", panel);
      gsap.fromTo(visual, { x: 80 }, { x: -40, ease: "none", scrollTrigger: { trigger: panel, containerAnimation: tween, start: "left 100%", end: "right 0%", scrub: true } });
    });
    return () => gsap.set(track, { clearProps: "transform" });
  });
  mm.add("(max-width: 1023px)", () => {
    panels.forEach((panel) => gsap.from(panel, { opacity: 0, y: 48, duration: 1, ease: "power3.out", scrollTrigger: { trigger: panel, start: "top 88%", once: true } }));
  });

  // Trajectory rail draws as you pass.
  const rail = q("[data-tl-line]");
  if (rail) gsap.to(rail, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".timeline", start: "top 70%", end: "bottom 60%", scrub: true } });

  // Parallax decor.
  qa("[data-parallax]").forEach((el) => {
    const amount = Number(el.dataset.parallax) || -10;
    gsap.fromTo(el, { yPercent: -amount, xPercent: -6 }, { yPercent: amount, xPercent: 6, ease: "none", scrollTrigger: { trigger: el.closest("section") || el, start: "top bottom", end: "bottom top", scrub: true } });
  });

  // Contact title scales in from the depth.
  if (q(".contact-title")) gsap.from(".contact-title", { scale: 0.86, opacity: 0.2, transformOrigin: "left bottom", ease: "none", scrollTrigger: { trigger: ".contact", start: "top 90%", end: "top 30%", scrub: true } });
}

/* ---- Panel visuals ----------------------------------------------------------------- */
function setupVisuals() {
  // Pointer-following glow on the panels.
  if (finePointer) {
    qa(".panel").forEach((panel) => {
      panel.addEventListener("pointermove", (e) => {
        const r = panel.getBoundingClientRect();
        panel.style.setProperty("--mx", `${((e.clientX - r.left) / r.width) * 100}%`);
        panel.style.setProperty("--my", `${((e.clientY - r.top) / r.height) * 100}%`);
      }, { passive: true });
    });
  }

  // Fleet: 40 devices coming into compliance in waves.
  const fleet = q("[data-fleet]");
  const fleetCount = q("[data-fleet-count]");
  if (fleet) {
    const tiles = Array.from({ length: 40 }, () => { const i = document.createElement("i"); fleet.append(i); return i; });
    if (!motion) {
      tiles.forEach((t) => t.classList.add("on"));
      if (fleetCount) fleetCount.textContent = "40";
    } else {
      let order = [];
      let n = 0;
      let timer = 0;
      const reset = () => { order = tiles.map((_, i) => i).sort(() => Math.random() - 0.5); n = 0; tiles.forEach((t) => t.classList.remove("on", "warn")); };
      const step = () => {
        if (n >= tiles.length) { timer = setTimeout(() => { reset(); step(); }, 1800); return; }
        const t = tiles[order[n++]];
        t.classList.add(Math.random() < 0.08 ? "warn" : "on");
        if (fleetCount) fleetCount.textContent = String(tiles.filter((x) => x.classList.contains("on")).length);
        timer = setTimeout(step, 90 + Math.random() * 140);
      };
      const io = new IntersectionObserver(([e]) => { clearTimeout(timer); if (e.isIntersecting) { reset(); step(); } });
      io.observe(fleet);
    }
  }

  // Chart: a drifting sign-in sparkline.
  const canvas = q("[data-chart]");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    const N = 42;
    const data = Array.from({ length: N }, (_, i) => 0.45 + 0.25 * Math.sin(i / 4) + Math.random() * 0.15);
    let offset = 0, raf = 0, last = 0, w = 0, h = 0, dpr = 1;
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    const blue = getComputedStyle(root).getPropertyValue("--accent-2").trim();
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = Math.round(r.width * dpr); h = Math.round(r.height * dpr);
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    };
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const padX = 24 * dpr, padT = 40 * dpr, padB = 36 * dpr;
      const step = (w - padX * 2) / (N - 2);
      const y = (v) => padT + (1 - v) * (h - padT - padB);
      const x = (i) => padX + (i - offset) * step;
      // Secondary series as bars.
      ctx.fillStyle = blue;
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < N; i++) {
        const bh = (data[i] * 0.5) * (h - padT - padB);
        ctx.fillRect(x(i) - step * 0.28, h - padB - bh, step * 0.56, bh);
      }
      ctx.globalAlpha = 1;
      // Area + line.
      ctx.beginPath();
      ctx.moveTo(x(0), y(data[0]));
      for (let i = 1; i < N; i++) {
        const cx = (x(i - 1) + x(i)) / 2;
        ctx.bezierCurveTo(cx, y(data[i - 1]), cx, y(data[i]), x(i), y(data[i]));
      }
      const grad = ctx.createLinearGradient(0, padT, 0, h - padB);
      grad.addColorStop(0, "rgba(198,255,74,0.28)");
      grad.addColorStop(1, "rgba(198,255,74,0)");
      ctx.save();
      ctx.lineTo(x(N - 1), h - padB); ctx.lineTo(x(0), h - padB); ctx.closePath();
      ctx.fillStyle = grad; ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(x(0), y(data[0]));
      for (let i = 1; i < N; i++) {
        const cx = (x(i - 1) + x(i)) / 2;
        ctx.bezierCurveTo(cx, y(data[i - 1]), cx, y(data[i]), x(i), y(data[i]));
      }
      ctx.strokeStyle = accent; ctx.lineWidth = 2 * dpr; ctx.lineJoin = "round"; ctx.stroke();
      // Live marker.
      const lx = x(N - 2), ly = y(data[N - 2]);
      ctx.fillStyle = accent;
      ctx.beginPath(); ctx.arc(lx, ly, 4 * dpr, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(lx, ly, 12 * dpr, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
      // Axis labels.
      ctx.fillStyle = "rgba(170,177,191,0.7)"; ctx.font = `${10 * dpr}px "Geist Mono", monospace`; ctx.textAlign = "left";
      ctx.fillText("sign-ins / h", padX, 22 * dpr);
      ctx.textAlign = "right"; ctx.fillText("live", w - padX, 22 * dpr);
    };
    const loop = (now) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      offset += dt * 1.1;
      while (offset >= 1) {
        offset -= 1;
        const prev = data[data.length - 1];
        data.shift();
        data.push(Math.min(0.95, Math.max(0.1, prev + (Math.random() - 0.5) * 0.22 + (0.5 - prev) * 0.08)));
      }
      draw();
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    let visible = false;
    const ro = new ResizeObserver(() => { resize(); draw(); });
    ro.observe(canvas);
    if (motion) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
      }).observe(canvas);
      document.addEventListener("visibilitychange", () => { if (!document.hidden && visible && !raf) { last = performance.now(); raf = requestAnimationFrame(loop); } });
    }
  }
}

/* ---- Cursor & magnetic buttons -------------------------------------------------------- */
function setupPointer() {
  if (!(motion && hasGsap && finePointer)) return;
  const cursor = q(".cursor");
  if (cursor) {
    const dot = q(".cursor-dot", cursor);
    const ring = q(".cursor-ring", cursor);
    const label = q("[data-cursor-label]", cursor);
    const dx = gsap.quickTo(dot, "x", { duration: 0.08, ease: "power3" });
    const dy = gsap.quickTo(dot, "y", { duration: 0.08, ease: "power3" });
    const rx = gsap.quickTo(ring, "x", { duration: 0.32, ease: "power3" });
    const ry = gsap.quickTo(ring, "y", { duration: 0.32, ease: "power3" });
    let shown = false;
    window.addEventListener("pointermove", (e) => {
      if (!shown) { shown = true; root.classList.add("has-cursor"); gsap.set([dot, ring], { x: e.clientX, y: e.clientY }); }
      dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY);
    }, { passive: true });
    document.addEventListener("pointerover", (e) => {
      const t = e.target.closest("a, button, [role=option], input");
      cursor.classList.toggle("is-hover", !!t);
      if (label) label.textContent = t?.dataset.cursor || (t ? "Go" : "");
    });
    window.addEventListener("pointerdown", () => cursor.classList.add("is-down"));
    window.addEventListener("pointerup", () => cursor.classList.remove("is-down"));
    document.addEventListener("mouseleave", () => gsap.to(cursor, { opacity: 0, duration: 0.2 }));
    document.addEventListener("mouseenter", () => gsap.to(cursor, { opacity: 1, duration: 0.2 }));
  }

  qa("[data-magnetic]").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: 0.5, ease: "power3" });
    const yTo = gsap.quickTo(el, "y", { duration: 0.5, ease: "power3" });
    el.addEventListener("pointermove", (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.32);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.32);
    });
    el.addEventListener("pointerleave", () => gsap.to(el, { x: 0, y: 0, duration: 0.9, ease: "elastic.out(1, 0.4)" }));
  });
}

/* ---- Command palette -------------------------------------------------------------------- */
function setupPalette() {
  const dialog = q("#palette");
  if (!dialog || typeof dialog.showModal !== "function") return;
  const input = q("[data-palette-input]", dialog);
  const items = qa("[data-cmd]", dialog);
  const empty = q(".palette-empty", dialog);
  let active = 0;

  const visibleItems = () => items.filter((li) => !li.hidden);
  const setActive = (i) => {
    const vis = visibleItems();
    if (!vis.length) return;
    active = (i + vis.length) % vis.length;
    items.forEach((li) => li.classList.remove("is-active"));
    vis[active].classList.add("is-active");
    vis[active].scrollIntoView({ block: "nearest" });
  };
  const filter = () => {
    const needle = input.value.trim().toLowerCase();
    items.forEach((li) => {
      const hay = `${li.textContent} ${li.dataset.keys || ""}`.toLowerCase();
      li.hidden = needle !== "" && !needle.split(/\s+/).every((part) => hay.includes(part));
    });
    if (empty) empty.hidden = visibleItems().length > 0;
    setActive(0);
  };
  const open = () => { if (dialog.open) return; lenis?.stop(); dialog.showModal(); input.value = ""; filter(); input.focus(); };
  const close = () => { if (dialog.open) dialog.close(); };
  dialog.addEventListener("close", () => lenis?.start());

  const run = (li) => {
    const { cmd, arg } = li.dataset;
    close();
    switch (cmd) {
      case "goto": scrollToTarget(arg); history.replaceState(null, "", arg); break;
      case "open": window.open(arg, "_blank", "noopener"); break;
      case "download": { const a = document.createElement("a"); a.href = arg; a.download = ""; document.body.append(a); a.click(); a.remove(); break; }
      case "copy": navigator.clipboard?.writeText(arg).then(() => toast("Link copied"), () => toast("Couldn't copy")); break;
      case "motion": setMotion(!motion); break;
      case "replay": try { sessionStorage.removeItem("booted"); } catch {} location.reload(); break;
    }
  };

  qa("[data-palette-open]").forEach((b) => b.addEventListener("click", open));
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); dialog.open ? close() : open(); }
    else if (e.key === "/" && !dialog.open && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) { e.preventDefault(); open(); }
  });
  input.addEventListener("input", filter);
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(active + 1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(active - 1); }
    else if (e.key === "Enter") { e.preventDefault(); const li = visibleItems()[active]; if (li) run(li); }
  });
  items.forEach((li) => {
    li.addEventListener("click", () => run(li));
    li.addEventListener("pointermove", () => { const vis = visibleItems(); const i = vis.indexOf(li); if (i >= 0 && i !== active) setActive(i); });
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) close(); });
}

/* ---- Go ------------------------------------------------------------------------------------ */
(async () => {
  setupVisuals();
  setupPalette();
  setupPointer();
  await document.fonts?.ready;
  setupScroll();
  const booted = await runBoot();
  if (booted && lenis) lenis.scrollTo(0, { immediate: true });
  await heroIntro();
  if (hasGsap) ScrollTrigger.refresh();
})();
