import type { NextConfig } from "next";

const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

/**
 * Keep the browser policy deliberately self-hosted. The browser talks only to
 * same-origin route handlers; the LLM, mail provider, and OG font fetches are
 * server-to-server connections and do not belong in connect-src.
 */
export function getContentSecurityPolicy(
  isDevelopment = process.env.NODE_ENV === "development",
): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

type HeaderRule = {
  source: string;
  headers: Array<{ key: string; value: string }>;
  has?: Array<{ type: "header"; key: string; value: string }>;
};

/**
 * HSTS is matched on the transport assertion from the TLS terminator. This
 * prevents local HTTP development and an HTTP proxy hop from opting a browser
 * into HSTS, while still covering HTTPS behind the supported proxies.
 */
export function getSecurityHeaderRules(
  isProduction = process.env.NODE_ENV === "production",
): HeaderRule[] {
  const baseline = [
    { key: "Content-Security-Policy", value: getContentSecurityPolicy() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-XSS-Protection", value: "0" },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];

  const rules: HeaderRule[] = [{ source: "/:path*", headers: baseline }];

  if (isProduction) {
    rules.push({
      source: "/:path*",
      has: [
        { type: "header", key: "x-forwarded-proto", value: "https" },
      ],
      headers: [
        { key: "Strict-Transport-Security", value: HSTS_VALUE },
      ],
    });
  }

  return rules;
}

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Runtime data is created on the mounted volume or external stores.
  // Never package local users, magic links, charts, or shares into an image.
  outputFileTracingExcludes: {
    "/*": ["data/**/*"],
  },
  async headers() {
    return getSecurityHeaderRules();
  },
};

export default nextConfig;
