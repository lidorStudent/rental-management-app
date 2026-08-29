import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

/**
 * Builds docs/presentation.pdf from docs/09-presentation-script.md's slide list.
 *
 * The deck is HTML rendered to PDF by the Chromium that Playwright already installs for the
 * end-to-end tests, so building it adds no dependency to this project. The two diagrams are the
 * same SVG files the documents link to, inlined here so the PDF has no external references.
 *
 * Run: node scripts/buildPresentation.mjs
 */
const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const architectureDiagram = readFileSync(`${projectRoot}docs/diagrams/architecture.svg`, "utf8");
const entityRelationshipDiagram = readFileSync(
  `${projectRoot}docs/diagrams/entity-relationship.svg`,
  "utf8",
);

const DEPLOYED_ADDRESS = "rental-management-app-wine.vercel.app";

function bulletSlide({ title, lead, bullets, closing, numbered = false }) {
  // Seven lines only fit above the closing rule at a smaller size, and a numbered list does not
  // want a dash in front of its numbers as well.
  const density = bullets.length >= 6 ? " dense" : "";
  const listStyle = numbered ? " numbered" : "";
  return `
    <section class="slide${density}${listStyle}" data-number="NUMBER">
      <h2>${title}</h2>
      ${lead === undefined ? "" : `<p class="lead">${lead}</p>`}
      <ul>${bullets.map((bullet) => `<li>${bullet}</li>`).join("")}</ul>
      ${closing === undefined ? "" : `<p class="closing">${closing}</p>`}
    </section>`;
}

function diagramSlide({ title, diagram, caption }) {
  return `
    <section class="slide diagram-slide" data-number="NUMBER">
      <h2>${title}</h2>
      <div class="diagram">${diagram}</div>
      <p class="caption">${caption}</p>
    </section>`;
}

const slides = [
  `<section class="slide title" data-number="NUMBER">
     <h1>Rental Management</h1>
     <p class="subtitle">A rental system for small landlords, with a tenant portal</p>
     <p class="meta">Lidor Amraby &nbsp;·&nbsp; final project &nbsp;·&nbsp; ${DEPLOYED_ADDRESS}</p>
   </section>`,

  bulletSlide({
    title: "What it is",
    bullets: [
      "Buildings and the units inside them",
      "Tenancies: who rents what, for how long, at what rent",
      "A rent ledger the landlord writes as money arrives",
      "Repairs, reported by the tenant and followed to the end",
    ],
    closing: "It records money received. It is not a payment processor.",
  }),

  bulletSlide({
    title: "The problem",
    lead: "A spreadsheet, a phone, and a memory.",
    bullets: [
      "What is owed is arithmetic somebody does by hand",
      "The tenant cannot check anything without asking",
      "A repair promised by phone leaves no record",
    ],
  }),

  bulletSlide({
    title: "The users",
    bullets: [
      "<strong>Landlord</strong> — owns the portfolio, records everything",
      "<strong>Tenant</strong> — reads their own tenancy and its ledger",
      "A tenant has two writes: report a problem, confirm a repair",
    ],
    closing: "Neither of them is rent. Only the landlord records money.",
  }),

  bulletSlide({
    title: "The business value",
    bullets: [
      "Arrears visible at a glance, always current",
      "Fewer phone calls: the tenant sees their own position",
      "Every repair has a timestamped route and a confirmation",
    ],
  }),

  bulletSlide({
    title: "How it is built",
    bullets: [
      "Next.js App Router, TypeScript, deployed on Vercel",
      "Supabase: Postgres, Auth, Row Level Security",
      "Server components read. Server actions write.",
      "No database client in the browser at all",
    ],
    closing: "Authorisation lives in the database, not in the application.",
  }),

  diagramSlide({
    title: "The architecture",
    diagram: architectureDiagram,
    caption:
      "The routing is a convenience. The database is the boundary that refuses.",
  }),

  diagramSlide({
    title: "The database",
    diagram: entityRelationshipDiagram,
    caption:
      "No lease status column, no occupancy flag, no rent periods table. All derived.",
  }),

  bulletSlide({
    title: "Every write, the same seven steps",
    bullets: [
      "1 &nbsp; Resolve the acting user from the session",
      "2 &nbsp; Refuse anyone who is not the right role",
      "3 &nbsp; Parse the input with the form's own schema",
      "4 &nbsp; Apply the business rules that need other rows",
      "5 &nbsp; Write, with Row Level Security as the last word",
      "6 &nbsp; Revalidate the pages that changed",
      "7 &nbsp; Return a typed result the form can render",
    ],
    numbered: true,
    closing: "The landlord id comes from the session, never from the form.",
  }),

  `<section class="slide title" data-number="NUMBER">
     <h1>Demo</h1>
     <p class="subtitle">${DEPLOYED_ADDRESS}</p>
     <p class="meta">Including two deliberate failures: an overlapping tenancy, and one tenant reaching for another's data</p>
   </section>`,

  bulletSlide({
    title: "The tests",
    bullets: [
      "354 unit and component tests — the rules at their boundaries",
      "135 permission and database tests — against a real Postgres",
      "25 end-to-end tests — whole processes in a browser",
      "5 documented manual checks — print, layout, screen reader",
    ],
    closing: "The permission tests attack the database, not the interface.",
  }),

  bulletSlide({
    title: "Scale",
    lead: "Measured against synthetic portfolios, not assumed.",
    bullets: [
      "Tens of landlords: every page under about 120 ms of database time",
      "Hundreds: two problems, both measured and priced",
      "Functions ran in Washington, database in Frankfurt: moved, 647 → 338 ms",
      "98 ms → 314 ms purely because another landlord's rows exist",
    ],
  }),

  bulletSlide({
    title: "Security",
    bullets: [
      "Session in one HTTP-only cookie, against the library default",
      "29 Row Level Security policies, proved by 135 tests",
      "Validation always runs on the server",
      "Service role key: one caller, unreachable from the browser",
    ],
    closing: "Still missing, and written down: rate limiting, MFA, an audit log.",
  }),

  bulletSlide({
    title: "With more time",
    bullets: [
      "Done &nbsp; Functions moved beside the database: 66% off the median page",
      "1 &nbsp; Give two aggregate queries an indexable filter",
      "2 &nbsp; More than one person on a portfolio",
      "3 &nbsp; An audit log, and rate limiting on my own endpoints",
    ],
    numbered: true,
    closing: "In that order: measured effect over risk.",
  }),

  `<section class="slide title" data-number="NUMBER">
     <h1>Thank you</h1>
     <p class="subtitle">Deployed. Tested at three levels. Every decision written down.</p>
     <p class="meta">${DEPLOYED_ADDRESS} &nbsp;·&nbsp; github.com/lidorStudent/rental-management-app</p>
   </section>`,
];

let slideNumber = 0;
const numberedSlides = slides.map((slide) =>
  slide.replace('data-number="NUMBER"', `data-number="${(slideNumber += 1)}"`),
);

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Rental Management</title>
<style>
  @page { size: 13.3333in 7.5in; margin: 0; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
    color: #111111;
    background: #ffffff;
  }
  .slide {
    position: relative;
    width: 1280px;
    /* One pixel short of the page box: at exactly 720px Chromium spills every
       slide onto a second, empty page. */
    height: 719px;
    padding: 72px 88px 88px;
    page-break-after: always;
    break-after: page;
    overflow: hidden;
  }
  .slide::after {
    content: attr(data-number);
    position: absolute;
    right: 88px;
    bottom: 44px;
    font-size: 16px;
    color: #888888;
  }
  .slide::before {
    content: "Rental Management";
    position: absolute;
    left: 88px;
    bottom: 44px;
    font-size: 16px;
    color: #888888;
  }
  h1 { font-size: 76px; font-weight: 600; margin: 0 0 28px; letter-spacing: -1px; }
  h2 {
    font-size: 46px;
    font-weight: 600;
    margin: 0 0 40px;
    padding-bottom: 20px;
    border-bottom: 2px solid #111111;
  }
  .lead { font-size: 30px; color: #444444; margin: -18px 0 30px; }
  ul { margin: 0; padding: 0; list-style: none; }
  li {
    font-size: 31px;
    line-height: 1.5;
    margin-bottom: 22px;
    padding-left: 34px;
    position: relative;
  }
  li::before {
    content: "";
    position: absolute;
    left: 0;
    top: 20px;
    width: 14px;
    height: 2px;
    background: #111111;
  }
  .closing {
    position: absolute;
    left: 88px;
    right: 88px;
    bottom: 96px;
    font-size: 28px;
    font-weight: 600;
    padding-top: 22px;
    border-top: 1px solid #cccccc;
    margin: 0;
  }
  .dense li { font-size: 27px; margin-bottom: 13px; }
  .dense li::before { top: 18px; }
  .numbered li { padding-left: 0; }
  .numbered li::before { display: none; }
  .title { display: flex; flex-direction: column; justify-content: center; }
  .title::before { content: ""; }
  .title .subtitle { font-size: 34px; color: #333333; margin: 0 0 40px; }
  .title .meta { font-size: 22px; color: #666666; margin: 0; }
  .diagram-slide h2 { margin-bottom: 24px; }
  .diagram { height: 404px; }
  .diagram svg { width: 100%; height: 100%; }
  .caption {
    position: absolute;
    left: 88px;
    right: 88px;
    bottom: 74px;
    font-size: 24px;
    color: #333333;
    margin: 0;
    text-align: center;
  }
</style>
</head>
<body>${numberedSlides.join("\n")}</body>
</html>`;

const htmlPath = `${projectRoot}docs/presentation.html`;
writeFileSync(htmlPath, html, "utf8");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`file://${htmlPath}`);
await page.pdf({
  path: `${projectRoot}docs/presentation.pdf`,
  preferCSSPageSize: true,
  printBackground: true,
  pageRanges: `1-${slides.length}`,
});

for (const slideNumber of [1, 7, 8, 9]) {
  await page.locator(".slide").nth(slideNumber - 1).screenshot({
    path: `${process.env.SLIDE_SHOT_DIRECTORY ?? projectRoot}slide-${slideNumber}.png`,
  });
}

await browser.close();
console.log(`Built docs/presentation.pdf with ${slides.length} slides.`);
