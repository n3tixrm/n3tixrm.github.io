// mcdowell.dev: progressive enhancement for the theme toggle, KQL console,
// command palette and scroll effects. The page works without any of it.

const root = document.documentElement;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

/* ---- Theme -------------------------------------------------------------- */

function currentTheme() {
  return root.dataset.theme || (prefersDark.matches ? "dark" : "light");
}

function setTheme(theme) {
  root.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

function toggleTheme() {
  setTheme(currentTheme() === "dark" ? "light" : "dark");
  announce(`${currentTheme() === "dark" ? "Dark" : "Light"} theme`);
}

document.querySelectorAll("[data-theme-toggle]").forEach((button) => {
  button.addEventListener("click", toggleTheme);
});

/* ---- Toast -------------------------------------------------------------- */

let toastEl;
let toastTimer;

function announce(message) {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "toast";
    toastEl.setAttribute("role", "status");
    document.body.append(toastEl);
  }
  toastEl.textContent = message;
  toastEl.dataset.visible = "";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => delete toastEl.dataset.visible, 1800);
}

/* ---- Header + scroll ---------------------------------------------------- */

const header = document.querySelector(".site-header");
if (header) {
  const onScroll = () => header.toggleAttribute("data-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
}

const navLinks = new Map(
  [...document.querySelectorAll(".site-nav a[href^='#']")].map((a) => [a.getAttribute("href").slice(1), a]),
);
if (navLinks.size && "IntersectionObserver" in window) {
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        navLinks.forEach((link, id) => {
          if (id === entry.target.id) link.setAttribute("aria-current", "true");
          else link.removeAttribute("aria-current");
        });
      }
    },
    { rootMargin: "-45% 0px -50% 0px" },
  );
  navLinks.forEach((_, id) => {
    const section = document.getElementById(id);
    if (section) sectionObserver.observe(section);
  });
}

const revealables = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px" },
  );
  revealables.forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    revealObserver.observe(el);
  });
} else {
  revealables.forEach((el) => el.classList.add("is-visible"));
}

/* ---- KQL console -------------------------------------------------------- */

const QUERIES = {
  profile: {
    text: 'Profile\n| where Name == "Ryan McDowell"\n| project Role, Company, Focus, Status',
    columns: ["Role", "Company", "Focus", "Status"],
    rows: [["Modern Workplace Architect", "Netix Digital", "Identity · Endpoint · Observability", "● Open to consulting"]],
  },
  toolkit: {
    text: "Toolkit\n| summarize Tools = make_set(Tool) by Practice\n| order by Practice asc",
    columns: ["Practice", "Tools"],
    rows: [
      ["Automation", "PowerShell, Graph API, Logic Apps"],
      ["Identity & Security", "Entra ID, Conditional Access, SSO"],
      ["Modern Workplace", "Microsoft 365, Intune, Autopilot"],
      ["Observability", "KQL, Grafana, Log Analytics"],
    ],
  },
  career: {
    text: "Career\n| order by Started desc\n| project Period, Role, Company",
    columns: ["Period", "Role", "Company"],
    rows: [
      ["2024 — Now", "Founder & Director", "Netix Digital"],
      ["Previously", "Workplace Technology Lead", "NEXT Retail"],
    ],
  },
};

const KEYWORDS = /^(where|project|summarize|by|order|asc|desc|extend|take|and|or)$/;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Minimal KQL highlighter: enough for the handful of queries above. */
const TOKENS = /(?<str>"[^"\n]*"?)|(?<fn>[A-Za-z_]\w*(?=\())|(?<word>[A-Za-z_]\w*)|(?<op>==|=|\|)|(?<other>[^"A-Za-z_=|]+)/g;

function highlight(text) {
  let first = true;
  return text.replace(TOKENS, (token, ...args) => {
    const { str, fn, word, op } = args.at(-1);
    const safe = escapeHtml(token);
    if (str) return `<span class="s">${safe}</span>`;
    if (fn) return `<span class="f">${safe}</span>`;
    if (op) return `<span class="p">${safe}</span>`;
    if (word && first) {
      first = false;
      return `<span class="t">${safe}</span>`;
    }
    if (word && KEYWORDS.test(token)) return `<span class="k">${safe}</span>`;
    return safe;
  });
}

function renderResult(query) {
  const { columns, rows } = query;
  const cell = (value) => (value.startsWith("● ") ? `<span class="ok">●</span> ${escapeHtml(value.slice(2))}` : escapeHtml(value));

  if (rows.length === 1) {
    const items = columns
      .map((col, i) => `<div class="row-in" data-delay="${i}"><dt>${escapeHtml(col)}</dt><dd>${cell(rows[0][i])}</dd></div>`)
      .join("");
    return `<dl class="record">${items}</dl>`;
  }
  const head = columns.map((col) => `<th scope="col">${escapeHtml(col)}</th>`).join("");
  const body = rows
    .map((row, r) => `<tr class="row-in" data-delay="${r}">${row.map((v) => `<td>${cell(v)}</td>`).join("")}</tr>`)
    .join("");
  return `<table class="result-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function setupConsole(el) {
  const code = el.querySelector("[data-console-code]");
  const result = el.querySelector("[data-console-result]");
  const meta = el.querySelector("[data-console-meta]");
  const run = el.querySelector("[data-console-run]");
  const panel = el.querySelector("[role='tabpanel']");
  const tabs = [...el.querySelectorAll("[role='tab']")];
  let active = "profile";
  let runId = 0;

  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function execute(name, { animate = !reducedMotion.matches } = {}) {
    const query = QUERIES[name];
    if (!query) return;
    const id = ++runId;
    active = name;

    tabs.forEach((tab) => {
      const selected = tab.dataset.query === name;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) panel.setAttribute("aria-labelledby", tab.id);
    });

    run.disabled = true;
    result.dataset.state = "running";
    meta.textContent = "Running…";

    if (animate) {
      for (let i = 0; i <= query.text.length; i += 2) {
        if (id !== runId) return;
        code.innerHTML = highlight(query.text.slice(0, i)) + '<span class="caret"></span>';
        await wait(16);
      }
      await wait(260);
      if (id !== runId) return;
    }

    const started = performance.now();
    code.innerHTML = highlight(query.text);
    result.innerHTML = renderResult(query);
    result.querySelectorAll("[data-delay]").forEach((row) => {
      row.style.animationDelay = `${Number(row.dataset.delay) * 60}ms`;
      delete row.dataset.delay;
    });
    delete result.dataset.state;
    const elapsed = Math.max(1, Math.round(performance.now() - started));
    const count = query.rows.length;
    meta.textContent = `Completed · ${count} ${count === 1 ? "row" : "rows"} · ${elapsed} ms`;
    run.disabled = false;
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => execute(tab.dataset.query));
    tab.addEventListener("keydown", (event) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
      if (!step) return;
      event.preventDefault();
      const next = tabs[(index + step + tabs.length) % tabs.length];
      next.focus();
      execute(next.dataset.query);
    });
  });
  run.addEventListener("click", () => execute(active));

  // Play the opening query once the console is on screen.
  if (!reducedMotion.matches && "IntersectionObserver" in window) {
    const once = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        once.disconnect();
        execute(active);
      }
    });
    once.observe(el);
  }

  return { execute };
}

const consoleEl = document.querySelector("[data-console]");
const kqlConsole = consoleEl ? setupConsole(consoleEl) : null;

/* ---- Command palette ---------------------------------------------------- */

const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
document.querySelectorAll("[data-kbd]").forEach((kbd) => {
  kbd.textContent = isMac ? "⌘ K" : "Ctrl K";
});

const palette = document.getElementById("palette");

function go(hash) {
  const target = document.querySelector(hash);
  if (!target) return;
  target.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  history.pushState(null, "", hash);
}

function download(href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = "";
  document.body.append(a);
  a.click();
  a.remove();
}

const COMMANDS = [
  { group: "Sections", label: "Practice", icon: "01", run: () => go("#practice") },
  { group: "Sections", label: "Netix Digital", icon: "02", run: () => go("#netix") },
  { group: "Sections", label: "Experience", icon: "03", run: () => go("#experience") },
  { group: "Sections", label: "Approach", icon: "04", run: () => go("#approach") },
  { group: "Sections", label: "Contact", icon: "05", run: () => go("#contact") },
  { group: "Links", label: "LinkedIn", hint: "in/rynm", icon: "in", run: () => (location.href = "/linkedin") },
  { group: "Links", label: "GitHub", hint: "n3tixrm", icon: "gh", run: () => (location.href = "/github") },
  { group: "Links", label: "Visit netix.digital", hint: "↗", icon: "nx", run: () => (location.href = "https://netix.digital") },
  { group: "Links", label: "Save contact card", hint: ".vcf", icon: "↓", keywords: "vcard download", run: () => download("/ryan-mcdowell.vcf") },
  { group: "Actions", label: "Toggle light / dark theme", icon: "◐", keywords: "dark light mode colour color", run: toggleTheme },
  {
    group: "Actions",
    label: "Copy link to this page",
    icon: "⧉",
    keywords: "share url",
    run: async () => {
      try {
        await navigator.clipboard.writeText(location.origin + "/");
        announce("Link copied");
      } catch {
        announce("Couldn't copy the link");
      }
    },
  },
  ...(kqlConsole
    ? [{ group: "Actions", label: "Run a KQL query", hint: "toolkit.kql", icon: "▸", keywords: "console kusto", run: () => {
        window.scrollTo({ top: 0, behavior: reducedMotion.matches ? "auto" : "smooth" });
        kqlConsole.execute("toolkit");
      } }]
    : []),
];

if (palette && typeof palette.showModal === "function") {
  const input = palette.querySelector("[data-palette-input]");
  const list = palette.querySelector("[data-palette-list]");
  const empty = palette.querySelector("[data-palette-empty]");
  const form = palette.querySelector("[data-palette-form]");
  let matches = [];
  let activeIndex = 0;

  function score(command, q) {
    if (!q) return 1;
    const haystack = `${command.label} ${command.group} ${command.hint ?? ""} ${command.keywords ?? ""}`.toLowerCase();
    if (command.label.toLowerCase().startsWith(q)) return 3;
    if (haystack.includes(q)) return 2;
    // Loose subsequence match on the label, so "lnkd" still finds LinkedIn.
    let i = 0;
    for (const ch of command.label.toLowerCase()) if (ch === q[i]) i++;
    return i === q.length ? 1 : 0;
  }

  function setActive(index) {
    activeIndex = index;
    list.querySelectorAll("[role='option']").forEach((option, i) => {
      option.setAttribute("aria-selected", String(i === index));
      if (i === index) {
        input.setAttribute("aria-activedescendant", option.id);
        option.scrollIntoView({ block: "nearest" });
      }
    });
  }

  function render() {
    const q = input.value.trim().toLowerCase();
    matches = COMMANDS.map((command) => ({ command, s: score(command, q) }))
      .filter((m) => m.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0))
      .map((m) => m.command);

    list.replaceChildren();
    let lastGroup = null;
    matches.forEach((command, i) => {
      if (!q && command.group !== lastGroup) {
        const heading = document.createElement("li");
        heading.className = "palette-group";
        heading.setAttribute("role", "presentation");
        heading.textContent = command.group;
        list.append(heading);
        lastGroup = command.group;
      }
      const option = document.createElement("li");
      option.className = "palette-item";
      option.id = `palette-option-${i}`;
      option.setAttribute("role", "option");
      option.innerHTML = `<span class="palette-item-icon" aria-hidden="true"></span><span></span>`;
      option.children[0].textContent = command.icon;
      option.children[1].textContent = command.label;
      if (command.hint) {
        const hint = document.createElement("span");
        hint.className = "palette-hint";
        hint.textContent = command.hint;
        option.append(hint);
      }
      option.addEventListener("mousemove", () => activeIndex !== i && setActive(i));
      option.addEventListener("click", () => choose(i));
      list.append(option);
    });

    empty.hidden = matches.length > 0;
    input.setAttribute("aria-expanded", String(matches.length > 0));
    if (matches.length) setActive(0);
    else input.removeAttribute("aria-activedescendant");
  }

  function choose(index) {
    const command = matches[index];
    if (!command) return;
    palette.close();
    command.run();
  }

  function open() {
    if (palette.open) return;
    input.value = "";
    render();
    palette.showModal();
    input.focus();
  }

  input.addEventListener("input", render);
  input.addEventListener("keydown", (event) => {
    if (!matches.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + step + matches.length) % matches.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setActive(event.key === "Home" ? 0 : matches.length - 1);
    }
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    choose(activeIndex);
  });
  // Clicking the backdrop (the dialog element itself) closes the palette.
  palette.addEventListener("click", (event) => {
    if (event.target === palette) palette.close();
  });

  document.querySelectorAll("[data-palette-open]").forEach((button) => button.addEventListener("click", open));

  document.addEventListener("keydown", (event) => {
    const typing = event.target instanceof HTMLElement && event.target.closest("input, textarea, [contenteditable='true']");
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      palette.open ? palette.close() : open();
    } else if (event.key === "/" && !typing && !palette.open) {
      event.preventDefault();
      open();
    }
  });
}
