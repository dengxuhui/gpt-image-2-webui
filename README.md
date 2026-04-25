# ImgX Studio

> A polished GPT image generation workspace for designers, creators, and AI image workflows.

![ImgX Studio](./public/logo.png)

ImgX Studio 是一个面向设计师和内容创作者的 AI 图片工作台。它把 **GPT Image / OpenAI-compatible image API** 包装成一个更顺手的可视化界面：写 prompt、上传参考图、选择尺寸和质量、批量出图、挑选结果、继续二创，一条链路完成。

如果你正在找一个可以自托管、可改造、适合产品图/主视觉/灵感探索的 **gpt-image-2 WebUI**，这个项目可以直接作为你的起点。

## 为什么值得 Star

- **为 gpt-image-2 打造**：内置 `gpt-image-2`、`gpt-image-2-2026-04-21`、`gpt-image-1` 模型选项。
- **文生图 + 图生图**：支持无参考图生成，也支持上传参考图进行编辑/延展。
- **迭代式创作工作流**：选择生成结果后，可一键设为下一轮源图，继续做变体、商业精修、高清主视觉、局部重绘。
- **可靠多图生成**：选择 1-4 张输出时，会逐张请求补齐结果，减少接口批量限制导致的少图问题。
- **直连或代理两种模式**：可从浏览器直连 API，也可通过 `/api/images` 服务端代理，方便隐藏服务端 Key。
- **OpenAI-compatible endpoint**：基础地址会自动解析到 `/v1/images/generations` 或 `/v1/images/edits`，适合接入兼容接口。
- **多语言界面**：内置 English、简体中文、繁體中文、日本語、한국어、Español、Français、Deutsch、Português。
- **设计师友好的输出控制**：支持尺寸、质量、格式、透明/不透明背景、参考图上传和结果下载。

## 适合用来做什么

| 场景 | 你可以怎么用 |
| --- | --- |
| 产品主视觉 | 上传产品图，生成高端电商图、广告图、社媒封面 |
| 创意探索 | 一次生成多张候选图，快速比较方向 |
| 商业精修 | 以结果图为源图继续清理瑕疵、强化材质和光影 |
| 变体分叉 | 保持主体和构图，探索不同背景、角度、风格 |
| 私有部署 | 自己部署到服务器或 Vercel，团队内部使用 |

## 技术栈

- [Next.js 16](https://nextjs.org/) + React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui + Base UI
- OpenAI Node SDK
- Sonner Toast

## 快速开始

### 1. 克隆项目

```bash
git clone <your-repo-url>
cd gpt-image-2-webui
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

如果你只使用「浏览器直连」模式，可以不配置服务端环境变量，直接在页面里填写 API Key。

如果你想使用「服务端代理」模式，复制环境变量文件：

```bash
cp .env.example .env.local
```

然后填写：

```bash
OPENAI_API_KEY=sk-...
```

### 4. 启动开发服务

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 即可使用。

## 使用方式

1. 在 Prompt 区域输入创意描述，或点击内置预设。
2. 按需上传 PNG / JPG / WEBP 参考图，最多 4 张，单张最大 10MB。
3. 选择输出尺寸、质量、格式、背景和图片数量。
4. 在 Connection 区域选择请求模式：
   - **Browser direct**：浏览器直接请求接口，需要目标 endpoint 支持 CORS。
   - **Server proxy**：通过 `/api/images` 转发，可使用服务端 `OPENAI_API_KEY`。
5. 生成后选择最满意的一张，可下载，也可设为源图继续二创。

## 环境变量

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `OPENAI_API_KEY` | 否 | 服务端代理模式使用。页面填写的 Key 优先；未填写时会使用该环境变量。 |
| `NEXT_ASSET_PREFIX` | 否 | 为静态资源设置 asset prefix，适合部署到带子路径/CDN 的环境。 |

## 部署

### Vercel

1. Fork 本项目。
2. 在 Vercel 导入仓库。
3. 如需服务端代理模式，在 Vercel Project Settings 中添加 `OPENAI_API_KEY`。
4. 部署完成后访问项目域名。

### Node.js / Docker 场景

项目已开启 Next.js `standalone` 输出：

```bash
npm run build
npm run start
```

## API Key 与隐私说明

- 浏览器直连模式下，API Key 会从浏览器发往你配置的 endpoint。
- 勾选「Remember on this device」时，API Key 和 Base URL 仅保存在当前浏览器的 `localStorage`。
- 服务端代理模式可以通过环境变量 `OPENAI_API_KEY` 在服务端保存 Key，避免团队成员在页面中重复填写。

## 路线图

- [ ] 生成历史记录
- [ ] Prompt 模板管理
- [ ] 项目/画布分组
- [ ] 更多模型供应商预设
- [ ] Dockerfile 与一键部署模板

## 贡献

欢迎提交 Issue 和 Pull Request，尤其是：

- 新的 OpenAI-compatible endpoint 适配
- 更好的 prompt preset
- 多语言文案优化
- 工作流和 UI 体验改进
- 部署文档和示例

如果这个项目帮你节省了搭建 gpt-image-2 WebUI 的时间，欢迎点一个 Star，也欢迎把它分享给正在做 AI 图片工作流的朋友。

## License

当前仓库尚未包含 License 文件。正式开源前建议补充 MIT、Apache-2.0 或你偏好的开源许可证。
