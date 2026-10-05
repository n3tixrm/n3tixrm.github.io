import { ContentRender } from "./render";
import { LINKS, SITE, VCARD_PATHS, vcard } from "./site";

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const SECURITY_HEADERS: Record<string, string> = {
  "Content-Security-Policy": CSP,
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
};

/** Re-wrap a response with mutable headers and the site-wide security headers applied. */
function secure(response: Response, extra: Record<string, string> = {}): Response {
  const out = new Response(response.body, response);
  for (const [key, value] of Object.entries({ ...SECURITY_HEADERS, ...extra })) {
    out.headers.set(key, value);
  }
  return out;
}

function redirect(location: string, status: 301 | 302): Response {
  return secure(new Response(null, { status, headers: { Location: location } }), {
    "Cache-Control": status === 301 ? "public, max-age=86400" : "no-store",
  });
}

function cacheControlFor(pathname: string, isHtml: boolean): string {
  // Fonts and vendored libraries carry a version or never change: cache them for a year.
  if (pathname.startsWith("/fonts/") || pathname.startsWith("/vendor/")) return "public, max-age=31536000, immutable";
  if (isHtml) return "public, max-age=0, must-revalidate";
  return "public, max-age=3600, stale-while-revalidate=86400";
}

/** Stamps request-time details (edge location, year) into elements marked with data-edge. */
class EdgeStamp {
  constructor(private readonly values: Record<string, string>) {}

  element(el: Element): void {
    const key = el.getAttribute("data-edge");
    const value = key ? this.values[key] : undefined;
    if (value !== undefined) el.setInnerContent(value);
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return secure(new Response("Method Not Allowed", { status: 405 }), { Allow: "GET, HEAD" });
    }

    if (url.hostname === `www.${SITE.host}`) {
      url.hostname = SITE.host;
      return redirect(url.toString(), 301);
    }

    const path = url.pathname.replace(/\/+$/, "").toLowerCase() || "/";
    const target = LINKS[path.slice(1)];
    if (target) return redirect(target, 302);

    if (VCARD_PATHS.has(path)) {
      const body = request.method === "HEAD" ? null : vcard();
      return secure(new Response(body, { status: 200 }), {
        "Content-Type": "text/vcard; charset=utf-8",
        "Content-Disposition": 'attachment; filename="ryan-mcdowell.vcf"',
        "Cache-Control": "public, max-age=3600",
      });
    }

    const asset = await env.ASSETS.fetch(request);
    const isHtml = (asset.headers.get("Content-Type") ?? "").includes("text/html");
    const response = secure(asset, { "Cache-Control": cacheControlFor(url.pathname, isHtml) });

    if (!isHtml) return response;

    // The HTML is personalised per request, so the asset ETag no longer describes it.
    response.headers.delete("ETag");
    if (!response.body) return response;

    const colo = (request.cf as { colo?: string } | undefined)?.colo;
    return new HTMLRewriter()
      // Content sections (stack, career, links, the console fallback) come from
      // public/content.js, the same module the browser uses for the console.
      .on("[data-render]", new ContentRender())
      .on(
        "[data-edge]",
        new EdgeStamp({
          colo: colo ?? "the edge",
          year: String(new Date().getUTCFullYear()),
          path: url.pathname.slice(0, 120),
        }),
      )
      .transform(response);
  },
} satisfies ExportedHandler<Env>;

export interface Env {
  ASSETS: Fetcher;
}
