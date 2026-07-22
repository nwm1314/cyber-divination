import { afterEach, describe, expect, it } from "vitest";
import { assertSameOrigin } from "./origin";

function makeReq(
  method: string,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://localhost:3000/api/x", {
    method,
    headers,
  });
}

describe("assertSameOrigin", () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env = { ...prev };
  });

  it("GET 始终放行", () => {
    expect(assertSameOrigin(makeReq("GET"))).toBeNull();
  });

  function setNodeEnv(v: string) {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: v,
      configurable: true,
      writable: true,
    });
  }

  it("开发环境无 Origin 放行", () => {
    setNodeEnv("development");
    expect(assertSameOrigin(makeReq("POST"))).toBeNull();
  });

  it("生产环境无 Origin 拒绝", () => {
    setNodeEnv("production");
    delete process.env.AUTH_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const err = assertSameOrigin(makeReq("POST", { host: "example.com" }));
    expect(err).toMatch(/Origin/);
  });

  it("Origin 与 Host 匹配则通过", () => {
    setNodeEnv("production");
    const err = assertSameOrigin(
      makeReq("POST", {
        host: "app.example.com",
        origin: "https://app.example.com",
      }),
    );
    expect(err).toBeNull();
  });

  it("Origin 匹配 AUTH_URL 则通过", () => {
    setNodeEnv("production");
    process.env.AUTH_URL = "https://app.example.com";
    const err = assertSameOrigin(
      makeReq("POST", {
        host: "internal.proxy",
        origin: "https://app.example.com",
      }),
    );
    expect(err).toBeNull();
  });

  it("跨站 Origin 拒绝", () => {
    setNodeEnv("production");
    process.env.AUTH_URL = "https://app.example.com";
    const err = assertSameOrigin(
      makeReq("POST", {
        host: "app.example.com",
        origin: "https://evil.com",
      }),
    );
    expect(err).toMatch(/跨站|Origin/);
  });

  it("Referer 可作为后备", () => {
    setNodeEnv("production");
    const err = assertSameOrigin(
      makeReq("POST", {
        host: "app.example.com",
        referer: "https://app.example.com/account",
      }),
    );
    expect(err).toBeNull();
  });
});
