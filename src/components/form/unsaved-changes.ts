"use client";

import { useEffect } from "react";

/**
 * 草稿是否偏离挂载时的初值（B14）。
 *
 * 按字段值比较而非「是否被点过」：用户改回原值不算脏，避免误报离开弹窗。
 * 浅比较足够——表单草稿是扁平的字符串/布尔字段集合。
 */
export function isDraftChanged<T extends Record<string, unknown>>(
  current: T,
  initial: T,
): boolean {
  for (const key of Object.keys(initial) as (keyof T)[]) {
    if (current[key] !== initial[key]) return true;
  }
  return false;
}

/**
 * 有未提交输入时，让浏览器在关闭标签页/刷新/手输地址前询问用户。
 *
 * `active=false`（未挂载、无脏数据、已提交、组件卸载）时不注册监听，
 * 因此不会影响其他页面的正常离开。
 *
 * 局限：`beforeunload` 只覆盖**文档级**卸载；应用内 `<Link>` 与 `router.push`
 * 属于同一文档内的历史导航，浏览器不会触发它。App Router 目前未提供公开的
 * 导航拦截 API，向导内的「上一步/下一步」是组件内状态切换，也不丢数据。
 */
export function useUnsavedChangesGuard(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome 要求显式赋值 returnValue 才会弹出确认框
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);
}
