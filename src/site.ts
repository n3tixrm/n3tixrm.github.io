// Single source of truth for the identity details the Worker serves
// (short links, the downloadable contact card).

export const SITE = {
  host: "mcdowell.dev",
  name: { given: "Ryan", family: "McDowell" },
  title: "Modern Workplace Architect",
  org: "Netix Digital",
  note: "Microsoft 365 specialist. Founder of Netix Digital.",
} as const;

/** Short links: mcdowell.dev/<key> redirects to the target. */
export const LINKS: Record<string, string> = {
  linkedin: "https://www.linkedin.com/in/rynm/",
  in: "https://www.linkedin.com/in/rynm/",
  github: "https://github.com/n3tixrm",
  gh: "https://github.com/n3tixrm",
  netix: "https://netix.digital",
};

export const VCARD_PATHS = new Set(["/vcard", "/ryan-mcdowell.vcf"]);

/** Escape text values per RFC 6350 §3.4. */
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export function vcard(): string {
  const { name, title, org, note, host } = SITE;
  const lines = [
    "BEGIN:VCARD",
    "VERSION:4.0",
    `FN:${esc(`${name.given} ${name.family}`)}`,
    `N:${esc(name.family)};${esc(name.given)};;;`,
    `TITLE:${esc(title)}`,
    `ORG:${esc(org)}`,
    `NOTE:${esc(note)}`,
    `URL;TYPE=home:https://${host}`,
    `URL;TYPE=work:${LINKS.netix}`,
    `X-SOCIALPROFILE;TYPE=linkedin:${LINKS.linkedin}`,
    `X-SOCIALPROFILE;TYPE=github:${LINKS.github}`,
    "END:VCARD",
  ];
  return lines.join("\r\n") + "\r\n";
}
