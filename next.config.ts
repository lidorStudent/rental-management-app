import type { NextConfig } from "next";

/**
 * The response headers every page carries.
 *
 * The content security policy is built from what this application actually loads, measured rather
 * than copied: every request the browser makes is same-origin. The fonts are self-hosted by
 * next/font at build time, there is no browser Supabase client so nothing connects to Supabase from
 * the page, there are no images, no external stylesheets and no third-party scripts of any kind.
 * That is why every directive below is `'self'` or narrower.
 *
 * script-src carries 'unsafe-inline', and that is a deliberate trade rather than an oversight. Next
 * streams the server-rendered payload into the document as two inline <script> blocks, so a policy
 * without either 'unsafe-inline' or a per-request nonce blocks them, no JavaScript runs, and every
 * form on the site stops working. A nonce is the stronger answer, but a nonce has to be generated
 * per request, which means moving the policy out of this file and into the proxy - the one file in
 * this project it is least sensible to complicate nine days before submission. What is kept is
 * still worth having: an injected script cannot be *loaded* from another origin, and connect-src
 * 'self' means an injected script cannot send anything it steals anywhere. What is given up is
 * protection against injected *inline* script, and this application renders no user-controlled HTML
 * anywhere - there is no dangerouslySetInnerHTML in the codebase - so React's escaping is the guard
 * that would have to fail first.
 *
 * style-src carries 'unsafe-inline' because React writes style attributes onto elements it renders.
 * CSS injection is a far weaker vector than script injection, and the alternative is rewriting
 * component markup for no security gain worth the change.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          // frame-ancestors above is the modern control; this is the header older browsers read.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Referrers stay inside this site. A lease page's URL carries an identifier, and there is
          // nowhere off-site for it to leak to, but there is no reason to send it either.
          { key: "Referrer-Policy", value: "same-origin" },
          // This product asks for no device capability at all, so every one is refused.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
