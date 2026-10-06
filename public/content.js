// mcdowell.dev: content module.
// Everything the page says lives here: who Ryan is, the career path, the tool
// stack, the links, and the five console sessions that play in the hero.
// Edit this file to change words; styles.css and app.js only decide how it looks
// and moves. Keep it free of dates and of numbers that read as achievements:
// the only real figure is the 35,000+ managed ChromeOS devices.

/* ---- Palette roles (each colour is a category, used consistently) ---------- */
// blue   → endpoint & devices, the pwsh session
// mint   → Microsoft 365 core, the kql session, links and highlighted words
// yellow → automation, the gam session
// purple → identity & security, the graph session
// red    → observability, the metrics session

export const person = {
  name: "Ryan McDowell",
  title: "Modern Workplace Architect",
  subtitle: "Microsoft 365 Specialist · Founder & Director, Netix Digital", // shown after the title in the hero
  tagline: "Possibility through technology.",
  availability: "Open to consulting",
  company: {
    name: "Netix Digital",
    url: "https://netix.digital",
    short: "/netix",
    description:
      "A Microsoft-first, cybersecurity-led managed service provider for UK businesses: secure tenancy design, identity architecture, endpoint management, networking and ongoing support.",
  },
};

export const links = [
  { label: "LinkedIn", href: "/linkedin", cursor: "Open" },
  { label: "GitHub", href: "/github", cursor: "Open" },
  { label: "Netix Digital", href: "https://netix.digital", cursor: "Visit" },
  { label: "Contact card", href: "/ryan-mcdowell.vcf", download: true, primary: true, cursor: "Save" },
];

/* ---- Statement -------------------------------------------------------------- */
// Words wrapped in *asterisks* are highlighted in mint.
export const statement = {
  text: "I build modern workplaces that are *secure by design*: Microsoft first, *Google* when it fits, and measured end to end.",
  foot: [
    "Microsoft 365 specialist and a qualified generalist across the suite, from Entra ID and Intune to Exchange Online, Teams and SharePoint. Equally at home in Google Workspace and ChromeOS at scale.",
    "Founder & Director of Netix Digital, a Microsoft-first, cybersecurity-led managed service provider for UK businesses.",
  ],
};

/* ---- Tool stack (one block per colour) ------------------------------------- */
export const stack = [
  {
    id: "endpoint",
    colour: "blue",
    title: "Endpoint & devices",
    tools: ["Microsoft Intune", "Windows Autopilot", "ChromeOS", "Google Workspace", "Networking"],
    // The one real figure on the site.
    figure: { value: "35,000+", label: "managed ChromeOS devices" },
  },
  {
    id: "m365",
    colour: "mint",
    title: "Microsoft 365 core",
    tools: ["Exchange Online", "Teams", "SharePoint", "Azure"],
    lead: "M365",
    note: "Qualified generalist across the suite",
  },
  {
    id: "identity",
    colour: "purple",
    title: "Identity & security",
    tools: ["Entra ID", "Conditional Access", "SSO", "Zero trust", "SentinelOne"],
    lead: "Entra",
  },
  {
    id: "observability",
    colour: "red",
    title: "Observability",
    tools: ["Grafana", "Datadog", "Log Analytics", "KQL"],
    lead: "Grafana",
  },
  {
    id: "automation",
    colour: "yellow",
    title: "Automation",
    tools: ["PowerShell", "Microsoft Graph API", "Logic Apps"],
    lead: "pwsh",
  },
];

/* ---- Career path (most recent first, grouped by employer, no dates) ---------- */
export const career = [
  {
    employer: "Netix Digital",
    href: "https://netix.digital",
    colour: "mint",
    feature: true,
    roles: [
      {
        title: "Founder & Director",
        text: person.company.description,
      },
    ],
  },
  {
    employer: "NEXT Retail",
    colour: "purple",
    roles: [
      {
        title: "Cyber Security Architect",
        text: "Cyber security architecture for a major UK retailer: identity, access and the controls around a modern workplace at enterprise scale.",
      },
      {
        title: "Workplace Technology Lead",
        text: "Led modern workplace strategy at a major UK retailer: Microsoft 365 adoption, endpoint management and cloud identity at enterprise scale.",
      },
    ],
  },
];

/* ---- Boot sequence (connects the sessions) ---------------------------------- */
export const boot = [
  { id: "pwsh", colour: "blue", text: "Connect-MgGraph" },
  { id: "kql", colour: "mint", text: "workspace" },
  { id: "gam", colour: "yellow", text: "customer" },
  { id: "graph", colour: "purple", text: "token" },
  { id: "metrics", colour: "red", text: "datasource" },
  { id: "edge", colour: "mint", text: "{colo}" }, // {colo} is replaced with the Cloudflare location
];

/* ---- Console sessions --------------------------------------------------------
   Each session has a chip colour, a prompt and a list of steps. A step types a
   command (an array of plain strings and [tokenClass, text] pairs) and then
   renders an output. Token classes: cmd, param, str, op, kw, fn, num, var, url,
   method, path, comment, type, prop.

   Output kinds:
     lines      { kind, lines: [string | { text, cls }] }
     kv         { kind, rows: [[key, value, cls?]] }           PowerShell Format-List
     table      { kind, cols: [..], rows: [[..]], highlight? } fixed-width table
     bars       { kind, rows: [[label, value, display?]] }     horizontal bars
     donut      { kind, rows: [[label, value]] }               pie / donut with legend
     timeseries { kind, series: [{ name, data: [..] }], unit } small line chart
     json       { kind, data: {...} }                          expanding tree
     progress   { kind, steps: [string], final: string, stat: { value, label } }
   Every number except the ChromeOS figure is sample data.
*/
export const sessions = [
  {
    id: "pwsh",
    colour: "blue",
    label: "pwsh",
    title: "Microsoft Graph PowerShell",
    prompt: [["path", "PS C:\\>"]],
    steps: [
      {
        cmd: [["cmd", "Connect-MgGraph"], " ", ["param", "-Scopes"], " ", ["str", "'User.Read.All'"], ",", ["str", "'DeviceManagementManagedDevices.Read.All'"]],
        output: { kind: "lines", lines: [{ text: "Welcome to Microsoft Graph!", cls: "ok" }] },
      },
      {
        cmd: [
          ["cmd", "Get-MgUser"], " ", ["param", "-Filter"], " ", ["str", "\"displayName eq 'Ryan McDowell'\""], " ", ["op", "|"], "\n  ",
          ["cmd", "Select-Object"], " ", ["prop", "DisplayName"], ", ", ["prop", "JobTitle"], ", ", ["prop", "CompanyName"], " ", ["op", "|"], " ", ["cmd", "Format-List"],
        ],
        output: {
          kind: "kv",
          rows: [
            ["DisplayName", "Ryan McDowell", "hero"],
            ["JobTitle", "Modern Workplace Architect"],
            ["CompanyName", "Netix Digital"],
            ["Availability", "Open to consulting", "accent"],
          ],
        },
      },
      {
        cmd: [
          ["cmd", "Get-MgDeviceManagementManagedDevice"], " ", ["param", "-All"], " ", ["op", "|"], "\n  ",
          ["cmd", "Group-Object"], " ", ["prop", "ComplianceState"], " ", ["op", "|"], " ", ["cmd", "Select-Object"], " ", ["prop", "Name"], ", ", ["prop", "Count"],
        ],
        output: {
          kind: "bars",
          rows: [["compliant", 46], ["inGracePeriod", 3], ["noncompliant", 2], ["unknown", 1]],
        },
      },
    ],
  },
  {
    id: "kql",
    colour: "mint",
    label: "kql",
    title: "Log Analytics",
    prompt: [["path", "la-workspace"], ["op", ">"]],
    steps: [
      {
        cmd: [
          ["type", "SigninLogs"], "\n", ["op", "|"], " ", ["kw", "where"], " ", ["prop", "TimeGenerated"], " ", ["op", ">"], " ", ["fn", "ago"], "(", ["num", "24h"], ")", "\n",
          ["op", "|"], " ", ["kw", "summarize"], " ", ["fn", "count"], "() ", ["kw", "by"], " ", ["prop", "ResultType"], "\n",
          ["op", "|"], " ", ["kw", "render"], " ", ["kw", "piechart"],
        ],
        output: {
          kind: "donut",
          rows: [["0 · success", 128], ["50074 · MFA required", 9], ["50126 · bad credentials", 4], ["53003 · blocked by policy", 2]],
        },
      },
      {
        cmd: [
          ["type", "Career"], "\n", ["op", "|"], " ", ["kw", "order by"], " ", ["prop", "Recency"], " ", ["kw", "asc"], "\n",
          ["op", "|"], " ", ["kw", "project"], " ", ["prop", "Role"], ", ", ["prop", "Company"],
        ],
        output: {
          kind: "table",
          cols: ["Role", "Company"],
          rows: [
            ["Founder & Director", "Netix Digital"],
            ["Cyber Security Architect", "NEXT Retail"],
            ["Workplace Technology Lead", "NEXT Retail"],
          ],
        },
      },
      {
        cmd: [
          ["type", "SigninLogs"], "\n", ["op", "|"], " ", ["kw", "where"], " ", ["prop", "TimeGenerated"], " ", ["op", ">"], " ", ["fn", "ago"], "(", ["num", "7d"], ")", "\n",
          ["op", "|"], " ", ["kw", "summarize"], " ", ["fn", "count"], "() ", ["kw", "by"], " ", ["fn", "bin"], "(", ["prop", "TimeGenerated"], ", ", ["num", "6h"], ")", "\n",
          ["op", "|"], " ", ["kw", "render"], " ", ["kw", "timechart"],
        ],
        output: {
          kind: "timeseries",
          unit: "sign-ins / 6h",
          series: [{ name: "count_", data: [14, 22, 31, 28, 36, 44, 39, 47, 52, 41, 38, 49, 58, 54, 46, 51, 63, 57, 49, 44, 52, 61, 66, 59, 48, 42, 55, 64] }],
        },
      },
    ],
  },
  {
    id: "gam",
    colour: "yellow",
    label: "gam",
    title: "Google Workspace admin",
    prompt: [["path", "ryan@admin"], ":", ["path", "~"], ["op", "$"]],
    steps: [
      {
        cmd: [["cmd", "gam"], " print cros ", ["param", "fields"], " serialNumber,status,osVersion ", ["op", ">"], " cros.csv"],
        output: {
          kind: "progress",
          steps: [
            "Getting all ChromeOS Devices for the customer (may take some time on a large account)...",
            "Got 5,000 ChromeOS Devices...",
            "Got 15,000 ChromeOS Devices...",
            "Got 25,000 ChromeOS Devices...",
            "Got 35,000+ ChromeOS Devices...",
          ],
          stat: { value: "35,000+", label: "managed ChromeOS devices" },
        },
      },
      {
        cmd: [["cmd", "gam"], " print cros ", ["param", "query"], " ", ["str", "\"status:active\""], " ", ["param", "fields"], " deviceId,status,osVersion ", ["op", "|"], " ", ["cmd", "head"], " ", ["param", "-4"]],
        output: {
          kind: "table",
          cols: ["deviceId", "status", "osVersion"],
          rows: [
            ["8f3c…a1", "ACTIVE", "sample"],
            ["2b7e…09", "ACTIVE", "sample"],
            ["c41d…7f", "ACTIVE", "sample"],
          ],
          mono: true,
        },
      },
    ],
  },
  {
    id: "graph",
    colour: "purple",
    label: "graph",
    title: "Microsoft Graph API",
    prompt: [["path", "graph"], ["op", "❯"]],
    steps: [
      {
        cmd: [["method", "GET"], " ", ["url", "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies"], ["param", "?$select=displayName,state&$top=3"]],
        output: {
          kind: "table",
          cols: ["displayName", "state"],
          rows: [
            ["Require MFA for all users", "enabled"],
            ["Require compliant device", "enabled"],
            ["Block legacy authentication", "enabled"],
          ],
          status: "200 OK",
        },
      },
      {
        cmd: [["method", "GET"], " ", ["url", "https://graph.microsoft.com/v1.0/identity/conditionalAccess/policies/"], ["var", "{id}"]],
        output: {
          kind: "json",
          status: "200 OK",
          data: {
            displayName: "Require MFA and a compliant device",
            state: "enabled",
            conditions: {
              users: { includeUsers: ["All"], excludeGroups: ["sg-break-glass"] },
              applications: { includeApplications: ["All"] },
              clientAppTypes: ["all"],
            },
            grantControls: {
              operator: "AND",
              builtInControls: ["mfa", "compliantDevice"],
            },
          },
        },
      },
    ],
  },
  {
    id: "metrics",
    colour: "red",
    label: "metrics",
    title: "Observability",
    prompt: [["path", "datadog"], ["op", "❯"]],
    steps: [
      {
        cmd: [["fn", "avg"], ":", ["type", "system.cpu.user"], "{", ["prop", "env"], ":", ["str", "prod"], "} ", ["kw", "by"], " {", ["prop", "host"], "}"],
        output: {
          kind: "timeseries",
          unit: "% cpu",
          series: [
            { name: "host-01", data: [22, 24, 21, 27, 31, 29, 34, 38, 36, 41, 39, 35, 33, 37, 42, 46, 44, 40, 38, 35, 32, 30, 33, 36] },
            { name: "host-02", data: [15, 17, 16, 18, 22, 21, 24, 23, 27, 26, 29, 31, 28, 26, 24, 27, 30, 33, 31, 29, 27, 25, 26, 28] },
            { name: "host-03", data: [9, 11, 10, 12, 11, 14, 13, 16, 15, 14, 17, 19, 18, 16, 15, 17, 20, 22, 21, 19, 18, 17, 19, 21] },
          ],
        },
      },
      {
        cmd: [["fn", "top"], "(", ["fn", "avg"], ":", ["type", "system.disk.in_use"], "{", ["prop", "env"], ":", ["str", "prod"], "} ", ["kw", "by"], " {", ["prop", "host"], "}, ", ["num", "3"], ", ", ["str", "'mean'"], ", ", ["str", "'desc'"], ")"],
        output: {
          kind: "bars",
          rows: [["host-02", 71, "71%"], ["host-01", 58, "58%"], ["host-03", 43, "43%"]],
        },
      },
    ],
  },
];

/* ---- Command palette ------------------------------------------------------------ */
export const commands = [
  { cmd: "goto", arg: "#top", keys: "home hero top console", label: "Go to top", kbd: "↵" },
  { cmd: "goto", arg: "#about", keys: "about statement", label: "Go to About" },
  { cmd: "goto", arg: "#stack", keys: "stack tools skills intune entra grafana powershell", label: "Go to Stack" },
  { cmd: "goto", arg: "#career", keys: "career path experience next netix", label: "Go to Career path" },
  { cmd: "goto", arg: "#contact", keys: "contact talk consulting", label: "Go to Contact" },
  { cmd: "session", arg: "pwsh", keys: "pwsh powershell graph session console", label: "Run the pwsh session" },
  { cmd: "session", arg: "kql", keys: "kql kusto log analytics session console", label: "Run the kql session" },
  { cmd: "session", arg: "gam", keys: "gam google workspace chromeos session console", label: "Run the gam session" },
  { cmd: "session", arg: "graph", keys: "graph api conditional access json session console", label: "Run the graph session" },
  { cmd: "session", arg: "metrics", keys: "metrics datadog grafana observability session console", label: "Run the metrics session" },
  { cmd: "open", arg: "/linkedin", keys: "linkedin social", label: "Open LinkedIn", kbd: "↗" },
  { cmd: "open", arg: "/github", keys: "github code source", label: "Open GitHub", kbd: "↗" },
  { cmd: "open", arg: "https://netix.digital", keys: "netix website", label: "Open netix.digital", kbd: "↗" },
  { cmd: "download", arg: "/ryan-mcdowell.vcf", keys: "vcard contact card save", label: "Download contact card", kbd: ".vcf" },
  { cmd: "copy", arg: "https://mcdowell.dev/", keys: "copy link url share", label: "Copy link to this page" },
  { cmd: "motion", keys: "motion animation reduce toggle", label: "Toggle motion" },
  { cmd: "replay", keys: "replay intro boot connect", label: "Replay the connect sequence" },
];
