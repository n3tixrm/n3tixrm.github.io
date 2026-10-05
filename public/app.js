// mcdowell.dev — choreography layer. Everything here is progressive
// enhancement: the document reads fine without it. Words live in content.js.
import { boot as BOOT, commands as COMMANDS, sessions as SESSIONS } from "/content.js";
import { createConsole } from "/console.js";

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
root.classList.add(motion ? "motion-on" : "motion-off");

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

/* ---- Connect sequence (boot) ------------------------------------------------- */
function runBoot() {
  return new Promise((resolve) => {
    const boot = q("#boot");
    const list = q("#boot-lines");
    const bar = q(".boot-bar span");
    if (!boot || !list || !root.classList.contains("is-booting")) { root.classList.remove("is-booting"); return resolve(false); }

    const colo = q('[data-edge="colo"]')?.textContent?.trim() || "the edge";
    list.replaceChildren();
    const items = BOOT.map(({ id, colour, text }) => {
      const li = document.createElement("li");
      li.className = `is-${colour}`;
      const chip = document.createElement("span");
      chip.className = `chip is-${colour}`;
      chip.textContent = id;
      const msg = document.createElement("span");
      msg.className = "msg";
      msg.textContent = text.replace("{colo}", colo);
      const tick = document.createElement("span");
      tick.className = "tick";
      tick.textContent = "✓";
      li.append(chip, msg, tick);
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

    const step = 0.22;
    items.forEach((li, i) => setTimeout(() => li.classList.add("on"), 140 + i * step * 1000));
    if (hasGsap) gsap.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: items.length * step + 0.3, ease: "power2.inOut" });
    setTimeout(finish, items.length * step * 1000 + 700);
  });
}

/* ---- Console ------------------------------------------------------------------- */
let consoleCtl = null;
{
  const el = q("[data-console]");
  if (el) {
    // In motion mode the console waits for the connect sequence and hero intro.
    try { consoleCtl = createConsole(el, SESSIONS, { motion, autostart: !motion }); } catch (err) { console.warn("Console disabled:", err); }
  }
}

/* ---- Hero intro ------------------------------------------------------------------- */
const heroBits = [q(".hero-head"), q(".console"), q(".hero-tag")].filter(Boolean);
if (motion && hasGsap && heroBits.length) {
  gsap.set(q(".hero-head"), { opacity: 0, y: 18 });
  gsap.set(q(".console"), { opacity: 0, y: 36, scale: 0.985 });
  gsap.set(q(".hero-tag"), { opacity: 0, y: 10 });
}
root.classList.remove("pending");

async function heroIntro() {
  if (!(motion && hasGsap && heroBits.length)) return;
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.to(q(".hero-head"), { opacity: 1, y: 0, duration: 1 }, 0.05)
    .to(q(".console"), { opacity: 1, y: 0, scale: 1, duration: 1.2 }, 0.2)
    .to(q(".hero-tag"), { opacity: 1, y: 0, duration: 0.8 }, 0.7);
  await tl.then();
}

/* ---- Scroll choreography -------------------------------------------------------- */
function setupScroll() {
  if (!hasGsap) return;

  // Top bar tint, progress rail and active nav.
  const top = q(".top");
  if (top) ScrollTrigger.create({ start: 40, end: "max", onToggle: (self) => top.classList.toggle("is-scrolled", self.isActive) });
  if (q(".progress span")) gsap.to(".progress span", { scaleX: 1, ease: "none", scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 0.4 } });
  qa("[data-nav]").forEach((link) => {
    const section = q(link.getAttribute("href"));
    if (!section) return;
    ScrollTrigger.create({ trigger: section, start: "top 50%", end: "bottom 50%", onToggle: (self) => link.classList.toggle("is-active", self.isActive) });
  });

  if (!motion) return;

  // Hero: the console recedes as you scroll away.
  const hero = q(".hero");
  if (hero) gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } })
    .to(".console", { y: 60, scale: 0.97, opacity: 0.25, ease: "none" }, 0)
    .to(".hero-head", { opacity: 0, y: -30, ease: "none" }, 0);
  // The tagline sits below the console, so on tall (mobile) heroes it would still be
  // visible when it reaches the header. Fade it on its own, before it gets there.
  // fromTo, because the intro may still be fading the tagline in when this is created.
  if (q(".hero-tag")) gsap.fromTo(".hero-tag", { opacity: 1 }, { opacity: 0, ease: "none", immediateRender: false, scrollTrigger: { trigger: ".hero-tag", start: "top 75%", end: "top 40%", scrub: true } });

  // Statement: pinned, words light up as you scroll; <em> words go mint.
  const statement = q("[data-words]");
  if (statement) {
    const frag = document.createDocumentFragment();
    const spans = [];
    const addWords = (text, hot) => {
      text.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) { frag.append(" "); return; }
        const s = document.createElement("span");
        s.className = "w";
        s.textContent = part;
        if (hot) s.dataset.hot = "";
        frag.append(s);
        spans.push(s);
      });
    };
    statement.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) addWords(node.textContent, false);
      else addWords(node.textContent, node.tagName === "EM");
    });
    statement.replaceChildren(frag);
    const ink = getComputedStyle(root).getPropertyValue("--ink").trim();
    const accent = getComputedStyle(root).getPropertyValue("--accent").trim();
    const tl = gsap.timeline({ scrollTrigger: { trigger: ".statement", start: "top top", end: "+=140%", pin: true, scrub: 0.5, anticipatePin: 1 } });
    tl.fromTo(".statement .section-label", { opacity: 0 }, { opacity: 1, duration: 0.5 }, 0);
    spans.forEach((s, i) => tl.to(s, { color: "hot" in s.dataset ? accent : ink, duration: 0.6 }, 0.3 + i * 0.22));
    tl.fromTo(".statement-foot", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.2 }, ">-0.4");
    tl.to({}, { duration: 1 });
  }

  // Line reveals for titles.
  if (typeof SplitText !== "undefined") {
    qa("[data-lines]").forEach((el) => {
      if (el.closest(".hero")) return;
      SplitText.create(el, {
        type: "lines", mask: "lines", linesClass: "sl", autoSplit: true,
        onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: "power4.out", stagger: 0.09, scrollTrigger: { trigger: el, start: "top 88%", once: true } }),
      });
    });
  }

  // Generic reveals.
  qa("[data-reveal]").forEach((el) => {
    gsap.from(el, { opacity: 0, y: 40, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 88%", once: true } });
  });
  qa(".section-intro, .contact-text, .contact-links").forEach((el) => {
    gsap.from(el, { opacity: 0, y: 28, duration: 1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 92%", once: true } });
  });

  // Stack: the blocks grow in from the left, their tools follow.
  qa("[data-block]").forEach((block, i) => {
    const tl = gsap.timeline({ scrollTrigger: { trigger: block, start: "top 90%", once: true } });
    tl.from(block, { scaleX: 0.08, opacity: 0, duration: 1.1, ease: "power4.out", delay: i * 0.04 })
      .from(qa(".block-main > *, .block-figure, .block-lead", block), { opacity: 0, y: 14, duration: 0.6, stagger: 0.06, ease: "power3.out" }, "-=0.55")
      .from(qa(".block-tools li", block), { opacity: 0, y: 8, scale: 0.9, duration: 0.5, stagger: 0.04, ease: "back.out(2)" }, "-=0.5");
    if (finePointer) {
      const rx = gsap.quickTo(block, "rotationX", { duration: 0.5, ease: "power3" });
      const ry = gsap.quickTo(block, "rotationY", { duration: 0.5, ease: "power3" });
      gsap.set(block, { transformPerspective: 1200, transformOrigin: "center" });
      block.addEventListener("pointermove", (e) => {
        const r = block.getBoundingClientRect();
        ry(((e.clientX - r.left) / r.width - 0.5) * 5);
        rx(-((e.clientY - r.top) / r.height - 0.5) * 4);
      }, { passive: true });
      block.addEventListener("pointerleave", () => { rx(0); ry(0); });
    }
  });

  // Career rail draws as you pass.
  const rail = q("[data-rail-line]");
  if (rail) gsap.to(rail, { scaleY: 1, ease: "none", scrollTrigger: { trigger: ".rail-wrap", start: "top 72%", end: "bottom 60%", scrub: true } });

  // Contact title rises from the depth.
  if (q(".contact-title")) gsap.from(".contact-title", { scale: 0.88, opacity: 0.2, transformOrigin: "left bottom", ease: "none", scrollTrigger: { trigger: ".contact", start: "top 90%", end: "top 30%", scrub: true } });
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
      const t = e.target.closest("a, button, [role=option], [role=tab], input");
      cursor.classList.toggle("is-hover", !!t);
      if (label) label.textContent = t?.dataset.cursor || (t ? (t.getAttribute("role") === "tab" ? "Run" : "Go") : "");
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
  const list = q("[data-palette-list]", dialog);
  const empty = q(".palette-empty", dialog);
  const sessionColour = Object.fromEntries(SESSIONS.map((s) => [s.id, s.colour]));

  const items = COMMANDS.map((c) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.dataset.cmd = c.cmd;
    if (c.arg) li.dataset.arg = c.arg;
    li.dataset.keys = c.keys || "";
    if (c.cmd === "session") {
      const chip = document.createElement("span");
      chip.className = `chip is-${sessionColour[c.arg] || "mint"}`;
      chip.textContent = c.arg;
      li.append(chip);
    }
    const label = document.createElement("span");
    label.textContent = c.label;
    li.append(label);
    if (c.kbd) { const k = document.createElement("kbd"); k.textContent = c.kbd; li.append(k); }
    list.append(li);
    return li;
  });
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
      case "session": consoleCtl?.select(arg); scrollToTarget("#top"); q(`#tab-${arg}`)?.focus({ preventScroll: true }); break;
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
  setupPalette();
  setupPointer();
  await document.fonts?.ready;
  setupScroll();
  const booted = await runBoot();
  if (booted && lenis) lenis.scrollTo(0, { immediate: true });
  const intro = heroIntro();
  setTimeout(() => consoleCtl?.start(), motion ? 500 : 0);
  await intro;
  if (hasGsap) ScrollTrigger.refresh();
})();
