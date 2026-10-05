import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const BASE = "https://mcdowell.dev";

function get(path: string, init?: RequestInit) {
  return exports.default.fetch(new Request(`${BASE}${path}`, { redirect: "manual", ...init }));
}

describe("homepage", () => {
  it("serves the HTML with security headers", async () => {
    const res = await get("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    expect(res.headers.get("Content-Security-Policy")).toContain("default-src 'self'");
    expect(res.headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(res.headers.get("Strict-Transport-Security")).toContain("max-age=");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
    expect(res.headers.has("ETag")).toBe(false);

    const html = await res.text();
    expect(html).toContain("Ryan McDowell");
    expect(html).toContain(`<span data-edge="year">${new Date().getUTCFullYear()}</span>`);
  });

  it("stamps the Cloudflare colo into the HUD and footer", async () => {
    const req = new Request(`${BASE}/`, { cf: { colo: "LHR" } } as RequestInit);
    const html = await (await exports.default.fetch(req)).text();
    expect(html).toContain('data-edge="colo">LHR</span>');
    expect(html.match(/data-edge="colo">LHR<\/span>/g)?.length).toBeGreaterThanOrEqual(2);
    expect(html).not.toContain("the edge</span>");
  });

  it("keeps every page free of inline scripts and styles, so the CSP holds", async () => {
    for (const path of ["/", "/does-not-exist"]) {
      const html = await (await get(path, { headers: { "Sec-Fetch-Mode": "navigate" } })).text();
      expect(html).not.toMatch(/<style[\s>]/);
      expect(html).not.toMatch(/ style="/);
      expect(html).not.toMatch(/<script(?![^>]*\bsrc=)(?![^>]*application\/ld\+json)/);
      expect(html).not.toMatch(/\bon[a-z]+="/);
    }
  });

  it("sends no body for HEAD", async () => {
    const res = await get("/", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });
});

describe("static assets", () => {
  it("caches fonts immutably", async () => {
    const res = await get("/fonts/geist-latin-wght-normal.woff2");
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    await res.arrayBuffer();
  });

  it("caches versioned vendor scripts immutably", async () => {
    const res = await get("/vendor/gsap-3.15.0.min.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("javascript");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
    await res.arrayBuffer();
  });

  it("serves CSS with a short cache and security headers", async () => {
    const res = await get("/styles.css");
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/css");
    expect(res.headers.get("Cache-Control")).toContain("max-age=3600");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    await res.text();
  });
});

describe("routing", () => {
  it.each([
    ["/linkedin", "https://www.linkedin.com/in/rynm/"],
    ["/in", "https://www.linkedin.com/in/rynm/"],
    ["/github", "https://github.com/n3tixrm"],
    ["/GH/", "https://github.com/n3tixrm"],
    ["/netix", "https://netix.digital"],
  ])("redirects %s", async (path, location) => {
    const res = await get(path);
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe(location);
  });

  it("redirects www to the apex, keeping path and query", async () => {
    const res = await exports.default.fetch(
      new Request("https://www.mcdowell.dev/some/path?x=1", { redirect: "manual" }),
    );
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("https://mcdowell.dev/some/path?x=1");
  });

  it("rejects non-GET methods", async () => {
    const res = await get("/", { method: "POST", body: "x" });
    expect(res.status).toBe(405);
    expect(res.headers.get("Allow")).toBe("GET, HEAD");
  });

  it("serves the 404 page with the requested path stamped in", async () => {
    const res = await get("/does-not-exist", { headers: { "Sec-Fetch-Mode": "navigate" } });
    expect(res.status).toBe(404);
    const html = await res.text();
    expect(html).toContain("Access <em>blocked.</em>");
    expect(html).toContain('data-edge="path">/does-not-exist</span>');
  });

  it("escapes the requested path in the 404 page", async () => {
    const res = await get("/%3Cscript%3Ealert(1)%3C/script%3E", { headers: { "Sec-Fetch-Mode": "navigate" } });
    const html = await res.text();
    expect(html).not.toContain("<script>alert(1)</script>");
  });
});

describe("contact card", () => {
  it.each(["/vcard", "/ryan-mcdowell.vcf"])("serves a vCard at %s", async (path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/vcard; charset=utf-8");
    expect(res.headers.get("Content-Disposition")).toContain("ryan-mcdowell.vcf");
    const card = await res.text();
    expect(card.startsWith("BEGIN:VCARD\r\nVERSION:4.0\r\n")).toBe(true);
    expect(card).toContain("FN:Ryan McDowell\r\n");
    expect(card.endsWith("END:VCARD\r\n")).toBe(true);
  });
});
