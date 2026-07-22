/**
 * Next.js instrumentation hook（启动时执行一次）
 * 生产环境 fail-fast：禁止假登录开关、强制 AUTH_SECRET 等
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const { validateProductionConfig } = await import("@/lib/config/validate-prod");
  validateProductionConfig();
}
