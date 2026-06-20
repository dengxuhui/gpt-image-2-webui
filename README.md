# ImgX Studio

> A polished, self-hosted GPT Image workspace for teams that need product shots, campaign visuals, AI creative exploration, and multilingual image workflows.

![ImgX Studio logo](./public/logo.png)

**Read this in:** [English](./README.md) | [简体中文](./README.zh-CN.md) | [繁體中文](./README.zh-TW.md) | [日本語](./README.ja.md) | [한국어](./README.ko.md) | [Español](./README.es.md) | [Français](./README.fr.md) | [Deutsch](./README.de.md) | [Português](./README.pt.md)

## Turn GPT Image into a real creative workspace

ImgX Studio is a premium WebUI for **GPT Image / OpenAI-compatible image APIs**. It helps designers, marketers, product teams, and AI creators move from idea to production-ready visual in one focused flow: write a brief, upload references, tune output specs, generate multiple candidates, pick the strongest image, then keep iterating from that result.

If you want a beautiful, customizable, self-hosted **gpt-image-2 WebUI**, ImgX Studio is designed to be the fastest path from API access to a usable product.

## Product screenshots

<p align="center">
  <img src="./public/img.png" alt="ImgX Studio workspace" width="100%">
</p>

<p align="center">
  <img src="./public/img_1.png" alt="ImgX Studio generation controls and preview" width="100%">
</p>

<p align="center">
  <img src="./public/img_2.png" alt="ImgX Studio iteration workflow" width="100%">
</p>

## Why teams choose ImgX Studio

| What you need | How ImgX Studio helps |
| --- | --- |
| A polished image-generation UI | Modern Next.js interface with a designer-friendly control panel and clean result grid. |
| Reliable creative output | Requests 1-4 images as separate calls to reduce missing results from batch limits. |
| Text-to-image and image-to-image | Generate from a prompt or upload up to 4 references for edits, variations, and extensions. |
| Iteration, not one-off prompts | Select any generated image as the next source and continue with remix actions. |
| Flexible API routing | Use browser-direct requests or a server proxy through `/api/images` to keep keys on the server. |
| OpenAI-compatible endpoints | Base URLs are normalized automatically for `/v1/images/generations` and `/v1/images/edits`. |
| Global-ready interface | Ships with UI copy for 9 languages and dedicated README files for each supported language. |

## Built for high-value image workflows

| Workflow | Example use case |
| --- | --- |
| Product hero shots | Turn product photos into premium e-commerce visuals, ads, and social covers. |
| Campaign exploration | Generate several creative directions, compare them quickly, and branch from the strongest option. |
| Commercial retouching | Use a result as the source image, then refine artifacts, material realism, lighting, and composition. |
| Controlled variations | Keep the subject and layout stable while exploring backgrounds, angles, mood, and styling. |
| Private team deployment | Run it on your own server or Vercel for internal design, marketing, or content teams. |

## Highlight features

- **Designed for gpt-image-2**: includes `gpt-image-2`, `gpt-image-2-2026-04-21`, and `gpt-image-1` model options.
- **Reference-aware generation**: upload PNG, JPG, or WEBP reference images, up to 4 files and 10MB per file.
- **Creative iteration board**: choose a result, set it as the active source, then generate the next branch.
- **Remix recipes**: quickly apply variation, commercial polish, hero upscale, or local redraw instructions.
- **Output control**: choose smart, square, landscape, portrait, 2K, 4K, or custom dimensions from 64-8192 px per side.
- **Production formats**: export PNG, JPEG, or WEBP with auto, opaque, or transparent background modes.
- **Privacy-aware key handling**: store connection settings only in local browser storage, or keep server keys in `OPENAI_API_KEY`.
- **Localized product experience**: language switcher, locale-aware metadata, UI labels, prompt presets, and error messages.

## Supported languages

| Locale | README | UI support |
| --- | --- | --- |
| English | [README.md](./README.md) | Yes |
| 简体中文 | [README.zh-CN.md](./README.zh-CN.md) | Yes |
| 繁體中文 | [README.zh-TW.md](./README.zh-TW.md) | Yes |
| 日本語 | [README.ja.md](./README.ja.md) | Yes |
| 한국어 | [README.ko.md](./README.ko.md) | Yes |
| Español | [README.es.md](./README.es.md) | Yes |
| Français | [README.fr.md](./README.fr.md) | Yes |
| Deutsch | [README.de.md](./README.de.md) | Yes |
| Português | [README.pt.md](./README.pt.md) | Yes |

## Tech stack

- [Next.js 16](https://nextjs.org/) + React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui + Base UI
- OpenAI Node SDK
- Sonner Toast

## Quick Start

### 1. Clone

```bash
git clone <your-repo-url>
cd gpt-image-2-webui
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

For **browser direct** mode, you can skip server environment variables and enter the API key directly in the UI.

For **server proxy** mode, copy the example file:

```bash
cp .env.example .env.local
```

Then fill in:

```bash
OPENAI_API_KEY=sk-...
```

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use

1. Enter a prompt or start from a built-in prompt preset.
2. Optionally upload PNG / JPG / WEBP references, up to 4 images and 10MB per image.
3. Choose size, quality, output format, background, and image count.
4. Select a connection mode:
   - **Browser direct**: the browser calls your endpoint directly; the endpoint must support CORS.
   - **Server proxy**: the app forwards requests through `/api/images` and can use `OPENAI_API_KEY`.
5. Generate images, select the strongest result, download it, or set it as the source image for the next round.

## Use from Claude Code (MCP)

ImgX ships a built-in MCP server that exposes its image generation as standard tools, so **MCP clients like Claude Code can generate images without opening the web UI or running `npm run dev`**.

The MCP server is bundled into a single JS file (no dependency on tsx / tsconfig / working directory), so it can be registered at **user scope and loaded by Claude from any directory**.

**Setup:**

1. Make sure `OPENAI_API_KEY` is set in `.env.local` (see `.env.example`).
2. Build the MCP server (re-run after source changes):

   ```bash
   npm run build:mcp        # output: mcp-server/dist/index.mjs
   ```

3. Choose how to register it:

   - **This project only**: the repo ships `.mcp.json`; Claude Code auto-detects it when launched inside the project.
   - **Any directory (recommended)**: register at user scope with absolute paths:

     ```bash
     claude mcp add imgx -s user \
       -e IMGX_OUTPUT_DIR=/abs/path/to/repo/generated \
       -- node --env-file=/abs/path/to/repo/.env.local \
          /abs/path/to/repo/mcp-server/dist/index.mjs
     ```

4. Confirm `imgx` is Connected with `claude mcp list`, then ask "generate an image of a sunset beach".

**Provided tools:**

| Tool | Description |
| --- | --- |
| `imgx_generate` | Text-to-image generation from a prompt |
| `imgx_edit` | Image-to-image from a local reference image (absolute path) |

**Shared history:** Images generated via MCP are written to `IMGX_OUTPUT_DIR` (for user-scope registration, point it at the repo's `generated` directory with an absolute path — otherwise images land in the current working directory and the web UI won't see them). When you open the web history panel, they are merged with your local browser history and tagged with a "Claude Code" source badge.

> For source-level debugging use `npm run mcp` (runs the TS source via tsx, no build needed); but Claude loads the bundled output, so re-run `npm run build:mcp` after editing the code.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `OPENAI_API_KEY` | No | Used by server proxy mode and the MCP server. A key entered in the UI takes priority; otherwise the server env value is used. |
| `OPENAI_BASE_URL` | No | Upstream base URL used by the MCP server; defaults to the official endpoint. |
| `IMGX_OUTPUT_DIR` | No | Directory where MCP-generated images are saved; defaults to `./generated`. |
| `NEXT_ASSET_PREFIX` | No | Sets the static asset prefix for sub-path or CDN deployments. |

## Deploy

### Vercel

1. Fork this repository.
2. Import it into Vercel.
3. Add `OPENAI_API_KEY` in Vercel Project Settings if you want server proxy mode.
4. Deploy and open your project domain.

### Node.js / Docker-like environments

The project uses Next.js `standalone` output:

```bash
npm run build
npm run start
```

## API key and privacy

- In browser-direct mode, the API key is sent from the browser to the endpoint you configure.
- If you enable **Remember on this device**, the API key and base URL are stored only in the current browser's `localStorage`.
- In server-proxy mode, `OPENAI_API_KEY` can stay on the server so team members do not need to enter a shared key repeatedly.

## Roadmap

- [ ] Generation history
- [ ] Prompt template management
- [ ] Project / canvas grouping
- [ ] More model provider presets
- [ ] Dockerfile and one-click deployment templates

## Contributing

Issues and pull requests are welcome, especially for:

- OpenAI-compatible endpoint adapters
- Better prompt presets
- Localization improvements
- Workflow and UI refinements
- Deployment examples and docs

If ImgX Studio saves you time building a gpt-image-2 WebUI, consider starring the project and sharing it with creators who need a better AI image workflow.

## License

This repository does not include a License file yet. Add MIT, Apache-2.0, or your preferred open-source license before formal release.
