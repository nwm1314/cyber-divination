import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getContentSecurityPolicy,
  getSecurityHeaderRules,
} from "../../../next.config";

const productionCsp = getContentSecurityPolicy(false);
const hsts = "max-age=63072000; includeSubDomains; preload";

function headerMap(rule: { headers: Array<{ key: string; value: string }> }) {
  return new Map(rule.headers.map(({ key, value }) => [key, value]));
}

describe("Next security header baseline", () => {
  it("keeps development-only eval out of the production CSP", () => {
    expect(getContentSecurityPolicy(true)).toContain("'unsafe-eval'");
    expect(productionCsp).not.toContain("'unsafe-eval'");
  });

  it("covers core page, API, auth, export, static, and OG paths", () => {
    const rules = getSecurityHeaderRules(false);
    expect(rules).toHaveLength(1);
    expect(rules[0]?.source).toBe("/:path*");

    const headers = headerMap(rules[0]!);
    expect(headers.get("Content-Security-Policy")).toBe(productionCsp);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headers.get("X-Frame-Options")).toBe("DENY");
    expect(headers.get("X-XSS-Protection")).toBe("0");
    expect(headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
    expect(headers.get("Permissions-Policy")).toBe(
      "camera=(), microphone=(), geolocation=()",
    );

    for (const route of [
      "/",
      "/api/health",
      "/auth/login",
      "/account",
      "/_next/static/chunks/app.js",
      "/share/example/opengraph-image",
    ]) {
      expect(rules[0]?.source, route).toBe("/:path*");
    }
  });

  it("adds HSTS only for production HTTPS proxy assertions", () => {
    const developmentRules = getSecurityHeaderRules(false);
    const productionRules = getSecurityHeaderRules(true);

    expect(developmentRules.flatMap((rule) => rule.headers)).not.toContainEqual(
      { key: "Strict-Transport-Security", value: hsts },
    );
    expect(productionRules[1]).toEqual({
      source: "/:path*",
      has: [
        { type: "header", key: "x-forwarded-proto", value: "https" },
      ],
      headers: [{ key: "Strict-Transport-Security", value: hsts }],
    });
  });

  it("keeps proxy examples on the same production CSP and HSTS values", () => {
    const root = path.resolve(__dirname, "../../..");
    const nginx = readFileSync(
      path.join(root, "deploy", "nginx.example.conf"),
      "utf8",
    );
    const caddy = readFileSync(
      path.join(root, "deploy", "Caddyfile.example"),
      "utf8",
    );

    expect(nginx).toContain(`Content-Security-Policy "${productionCsp}"`);
    expect(caddy).toContain(`Content-Security-Policy "${productionCsp}"`);
    expect(nginx).toContain(`Strict-Transport-Security "${hsts}"`);
    expect(caddy).toContain(`Strict-Transport-Security "${hsts}"`);
  });
});
