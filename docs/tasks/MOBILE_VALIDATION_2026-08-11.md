# TASK-009 移动端验证记录（2026-08-11/12）

## 自动化补充

仓库已加入 `e2e/critical-flows.spec.ts`，使用 Chromium 的 iPhone 13 与 Pixel 5
设备描述，共覆盖 8 条流程、3 个项目。最终官方 Playwright 容器矩阵为：Chromium
8/8、Pixel 5 8/8、iPhone 13 8/8，共 24/24 通过，包含三术创建到阅读、档案/导出/删除、
同步提示、登录入口、匿名账号删除保护和 API 安全检查。

## 结论

桌面、Pixel 5 和 iPhone 13 代表性视口均完成自动化流程。iPhone 13 使用 390×844
CSS px 设备模拟，属于可重复的移动浏览器证据，不等同于真实 iOS 硬件认证；TASK-009
已关闭。

## 环境与视口

- Windows 工作区：`E:\ai_project\cyber-divination`。
- Next.js `16.2.10`；项目配置了 Playwright Chromium 与移动视口项目。
- iPhone 13 代表尺寸：`390 × 844` CSS px。
- Pixel 5 代表尺寸：`412 × 915` CSS px。
- 浏览器验收运行在隔离 Docker 栈和官方 Playwright 容器中；未触碰生产部署。

## 路径检查矩阵

| 路径 | iPhone 13 390×844 | Pixel 5 412×915 | 结论 |
| --- | --- | --- | --- |
| 主页 → 三术创建入口/无横向溢出 | 8/8 项目矩阵通过 | 8/8 项目矩阵通过 | 代表性视口通过 |
| 八字创建 → 看盘 → 阅读 | 通过 | 通过 | 代表性视口通过 |
| 紫微创建 → 看盘 → 阅读 | 通过 | 通过 | 窄屏宫格通过 |
| 六爻创建 → 看卦 → 阅读 | 通过 | 通过 | 代表性视口通过 |
| 档案浏览/导出/本地删除 | 通过 | 通过 | 本地生命周期通过 |
| 登录入口/同步提示/匿名删除保护 | 通过 | 通过 | 安全边界通过 |

## 已保存证据

- iOS 主页截图：`output/playwright/.playwright-cli/page-2026-08-11T16-03-36-814Z.png`。
- 最终浏览器矩阵：官方 Playwright 容器，Chromium + Pixel 5 `16/16`，iPhone 13 `8/8`。
- 最终 Docker 栈：非 root `nextjs`、liveness、DB/Redis readiness、迁移和 Web 容器重建后命名卷持久化均通过。

## 安全边界与限制

- 本次未执行真实设备硬件认证、真实账号登录或破坏性账号删除。
- 证据证明代表性移动浏览器视口可重复通过，不宣称物理 iOS/Android 设备认证。
