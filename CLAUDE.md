# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> 后续请始终使用中文回答。

@AGENTS.md

## 关于这份项目

ImgX Studio 是一个自托管的 GPT Image / OpenAI 兼容图像 API 的 WebUI（文生图 + 图生图），基于 **Next.js 16（App Router）+ React 19 + Tailwind CSS 4 + shadcn/ui（Base UI）**。整体只有一个页面（图像工作台），核心逻辑高度集中在两个大文件里。

## 常用命令

```bash
npm run dev          # 开发服务器（Webpack，默认）→ http://localhost:3000
npm run dev:turbo    # 开发服务器（Turbopack）
npm run build        # 生产构建（output: "standalone"）
npm run start        # 启动生产构建
npm run lint         # ESLint（eslint-config-next，含 core-web-vitals + typescript）
```

- 没有测试框架，没有 test 脚本——不要假设可以 `npm test`。
- 包管理器：仓库同时存在 `package-lock.json` 与 `pnpm-lock.yaml`；README 用 `npm install`，跟随 npm 即可。
- 类型检查走 `tsc`（`noEmit`，strict 模式），但没有独立脚本；构建时由 Next 校验。路径别名 `@/*` → `src/*`。

## 架构要点（需要读多个文件才能理解的部分）

### 请求链路：客户端永远走服务端代理
- 客户端 `src/components/image-studio.tsx` 里的 `callProxy()` **总是** `POST /api/images`（FormData），即使用户在 UI 填了 base URL 和 API key，也是把它们作为表单字段传给服务端，由服务端用 OpenAI SDK 发起上游请求。README 里说的“浏览器直连”在当前代码中并未单独实现为绕过代理的路径。
- 服务端路由 `src/app/api/images/route.ts`（`runtime = "nodejs"`，`maxDuration = 120`）才是真正调用上游的地方：用 `new OpenAI({ apiKey, baseURL, maxRetries: 0 })`，根据是否上传了参考图决定调 `images.edit`（图生图）还是 `images.generate`（文生图）。
- API key 优先级：表单里的 `apiKey` > 服务端环境变量 `OPENAI_API_KEY`。

### “n 张图 = n 次独立请求”是刻意设计
- 提交时 `handleSubmit` 不会一次性请求 n 张，而是**循环并发地每次 `callProxy(1)` 只要 1 张**，累计到目标数量（`total`，1–4），最多 `total + 2` 次尝试，部分失败也会把已成功的图先渲染出来（`publishResult` 增量更新 + 进度条）。目的是规避某些上游 batch 限制导致整批失败/缺图。修改生成逻辑时要保留这个“逐张 + 容错 + 增量展示”的语义。

### Endpoint 归一化（`src/lib/image-request.ts`）
- `normalizeOpenAIBaseURL` 把用户填的各种地址（裸域名、`.../v1`、`.../v1/images`、`.../v1/images/generations|edits`）统一回退成 OpenAI SDK 需要的 baseURL；空路径会补 `/v1`。
- `normalizeImageEndpoint` 据此拼出最终展示用的完整 endpoint（generations / edits）。
- `extractGeneratedImages` 是**容错解析器**：递归扫描 `data` / `images` / `output` / `content`，兼容 `b64_json` / `url` / `image` / `base64` / `result` 等多种字段，base64 会按 `outputFormat` 包成 `data:image/...`。新增兼容某个上游返回格式时改这里。

### i18n（`src/lib/i18n.ts`，单文件、无第三方 i18n 库）
- 9 种语言（en/zh/zh-TW/ja/ko/es/fr/de/pt）。英文对象 `en` 是**唯一真源**：`StudioMessages` 类型从 `typeof en` 推导，因此**新增任何文案 key 必须先加到 `en`，再补齐其余 8 个语言**，否则类型不过。
- `t(locale, key, values)` 做 `{name}`、`{count}` 等占位符替换；`studioPromptPresets` 是各语言的提示词预设；`pluralSuffix` / `isCjkLocale` / `getDocumentLang` 处理复数与 CJK 排版差异。
- 语言来源：Cookie `imgx.locale` + `accept-language`。服务端 `layout.tsx` / `page.tsx` 用 `resolveLocaleFrom` 决定首屏语言（SSR），客户端可切换并写回 cookie/localStorage。

### 客户端状态与持久化
- `image-studio.tsx`（~2500 行）是单一巨型 client 组件，承载全部交互状态：prompt、参考图上传（最多 4 张、单张 10MB、PNG/JPG/WEBP）、尺寸/质量/格式/背景/数量、连接设置、生成结果网格、以及“把某张结果设为下一轮源图”的迭代工作流（remix recipes：variations/retouch/upscale/inpaint）。
- 连接偏好存 localStorage（`imgx.connectionPreferences`，含旧版 `imgx.apiKey` 等迁移逻辑）。只有用户勾选“记住”时才落盘 API key 与 base URL。

### 约束常量（前后端各有一份，改动需同步）
- 尺寸 64–8192 px、自定义尺寸格式 `WxH`、文件 10MB、最多 4 张、质量/背景/格式枚举——客户端在 `image-studio.tsx` 顶部，服务端在 `route.ts` 顶部各自硬编码并校验，两边要保持一致。

## UI 组件约定
- 组件来自 shadcn/ui（`components.json`：style `base-nova`、baseColor neutral、底层用 `@base-ui/react`），位于 `src/components/ui/`。新增组件用 shadcn CLI 拉取，别手写；图标统一用 `lucide-react`；样式合并用 `cn()`（`src/lib/utils.ts`）。
- 全局样式与设计变量在 `src/app/globals.css`（Tailwind 4，CSS variables）。

## 环境变量
- `OPENAI_API_KEY`（可选）：服务端代理模式的兜底 key，存 `.env.local`。
- `NEXT_ASSET_PREFIX`（可选）：子路径 / CDN 部署的静态资源前缀，见 `next.config.ts`。
