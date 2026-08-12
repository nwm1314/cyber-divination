/**
 * 同源校验：降低跨站 POST 伪造风险（配合 Cookie SameSite=Lax）
 */

function hostFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function isLocalHost(value: string): boolean {
  try {
    const hostname = new URL(`http://${value}`).hostname.toLowerCase();
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  } catch {
    return false;
  }
}

function allowedHosts(): Set<string> {
  const hosts = new Set<string>();
  for (const key of ["AUTH_URL", "NEXT_PUBLIC_APP_URL"] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) continue;
    const h = hostFromUrl(raw.startsWith("http") ? raw : `https://${raw}`);
    if (h) hosts.add(h);
  }
  return hosts;
}

/**
 * 校验 Origin / Referer 是否与请求 Host 或配置的站点 URL 同源。
 * @returns null 表示通过；否则为错误消息
 */
export function assertSameOrigin(request: Request): string | null {
  const method = request.method.toUpperCase();
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  // X-Forwarded-Host is only trustworthy when a configured proxy strips and
  // rewrites it. The supported proxy examples preserve the public Host, so do
  // not let a direct caller choose the origin comparison host with this header.
  const requestHost = (request.headers.get("host") || "").trim().toLowerCase();

  // GET/HEAD 或无 Origin 的同源导航（部分浏览器不带 Origin）可放宽
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return null;
  }

  if (!origin && !referer) {
    // 生产写操作要求 Origin（或 Referer）；开发放宽以兼容 curl / 测试
    if (process.env.NODE_ENV === "production") {
      return "缺少 Origin，拒绝跨站写请求";
    }
    return null;
  }

  const candidate = origin ? hostFromUrl(origin) : hostFromUrl(referer);
  if (!candidate) {
    return "无法解析 Origin/Referer";
  }

  const allowed = allowedHosts();
  if (requestHost) allowed.add(requestHost);

  if (allowed.has(candidate)) {
    return null;
  }

  // 开发：localhost / 127.0.0.1 互通
  if (process.env.NODE_ENV !== "production") {
    const local = (h: string) => isLocalHost(h);
    if (local(candidate) && [...allowed].some(local)) {
      return null;
    }
    // 开发且未配置任何 allowed 时，仅比对 request Host
    if (requestHost && candidate === requestHost) return null;
    if (!requestHost && allowed.size === 0) return null;
  }

  return "跨站请求被拒绝（Origin 不匹配）";
}
