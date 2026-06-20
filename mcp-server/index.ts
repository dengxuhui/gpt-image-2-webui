/**
 * ImgX MCP Server —— 把 ImgX 的生图能力暴露为标准 MCP 工具。
 *
 * 以 STDIO 方式运行，由 Claude Code 等 MCP 客户端按需 spawn，无需启动网页服务。
 * 生成的图片会落盘到 ./generated（或 IMGX_OUTPUT_DIR），网页 /api/history 可读取合并展示。
 *
 * 本地调试：npm run mcp
 * 客户端接入：见项目根 .mcp.json
 */
import { readFile } from "node:fs/promises"
import path from "node:path"

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

import { generateImages } from "@/lib/generate-image"
import {
  DEFAULT_OPENAI_BASE_URL,
  normalizeImageEndpoint,
  normalizeOpenAIBaseURL,
} from "@/lib/image-request"
import { saveServerRecord } from "@/lib/server-history"

const SOURCE_LABEL = "Claude Code"
const DEFAULT_MODEL = "gpt-image-2"

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) {
    throw new Error(
      "缺少 OPENAI_API_KEY 环境变量。请在 .env.local 中配置，或在 .mcp.json 的 env 中注入。"
    )
  }
  return key
}

function getBaseConfig() {
  const rawEndpoint = process.env.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL
  return {
    apiKey: getApiKey(),
    baseURL: normalizeOpenAIBaseURL(rawEndpoint),
    rawEndpoint,
  }
}

/** 把 GeneratedImage 转为 MCP content 块：base64 → image 块，远程 URL → text 块 */
function toContentBlock(src: string) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(src)
  if (match) {
    return {
      type: "image" as const,
      data: match[2],
      mimeType: `image/${match[1].toLowerCase()}`,
    }
  }
  return { type: "text" as const, text: `图片地址：${src}` }
}

const server = new McpServer({ name: "imgx-studio", version: "1.0.0" })

server.registerTool(
  "imgx_generate",
  {
    title: "生成图片（文生图）",
    description:
      "用文字提示词生成 AI 图片。返回生成的图片，并自动落盘到本地 generated 目录，可在 ImgX 网页历史中查看。",
    inputSchema: {
      prompt: z.string().describe("图片描述提示词"),
      size: z
        .string()
        .optional()
        .describe("尺寸，如 1024x1024 / 1536x1024 / 1024x1536，默认 1024x1024"),
      quality: z
        .enum(["auto", "low", "medium", "high"])
        .optional()
        .describe("质量，默认 auto"),
      outputFormat: z
        .enum(["png", "jpeg", "webp"])
        .optional()
        .describe("输出格式，默认 png"),
      background: z
        .enum(["auto", "transparent", "opaque"])
        .optional()
        .describe("背景，默认 auto；transparent 需配合 png/webp"),
      n: z.number().int().min(1).max(4).optional().describe("生成数量 1-4，默认 1"),
      model: z.string().optional().describe(`模型，默认 ${DEFAULT_MODEL}`),
    },
  },
  async (args) => {
    const { apiKey, baseURL, rawEndpoint } = getBaseConfig()
    const outputFormat = args.outputFormat ?? "png"
    const model = args.model ?? DEFAULT_MODEL

    const result = await generateImages({
      apiKey,
      baseURL,
      endpoint: normalizeImageEndpoint(rawEndpoint, false),
      prompt: args.prompt,
      model,
      size: args.size ?? "1024x1024",
      quality: args.quality ?? "auto",
      outputFormat,
      background: args.background ?? "auto",
      n: args.n ?? 1,
    })

    if (!result.images.length) {
      return {
        isError: true,
        content: [{ type: "text", text: "上游未返回任何图片。" }],
      }
    }

    await saveServerRecord({
      prompt: args.prompt,
      endpoint: result.endpoint,
      model: result.model,
      outputFormat: result.outputFormat,
      quality: result.quality,
      size: result.size,
      images: result.images,
      sourceLabel: SOURCE_LABEL,
    })

    return {
      content: [
        {
          type: "text",
          text: `已生成 ${result.images.length} 张图片（${result.size}，${result.outputFormat}），已保存到本地 generated 目录，可在 ImgX 网页历史中查看。`,
        },
        ...result.images.map((img) => toContentBlock(img.src)),
      ],
    }
  }
)

server.registerTool(
  "imgx_edit",
  {
    title: "编辑图片（图生图）",
    description:
      "基于一张本地参考图与提示词生成新图片（图生图）。需提供本地图片的绝对路径。",
    inputSchema: {
      imagePath: z.string().describe("本地参考图的绝对路径（png/jpg/webp）"),
      prompt: z.string().describe("编辑/生成提示词"),
      size: z.string().optional().describe("尺寸，默认 1024x1024"),
      quality: z.enum(["auto", "low", "medium", "high"]).optional(),
      outputFormat: z.enum(["png", "jpeg", "webp"]).optional(),
      n: z.number().int().min(1).max(4).optional(),
      model: z.string().optional(),
    },
  },
  async (args) => {
    const { apiKey, baseURL, rawEndpoint } = getBaseConfig()
    const outputFormat = args.outputFormat ?? "png"
    const model = args.model ?? DEFAULT_MODEL

    const buffer = await readFile(args.imagePath)
    const ext = path.extname(args.imagePath).slice(1).toLowerCase()
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : `image/${ext || "png"}`
    const file = new File([buffer], path.basename(args.imagePath), { type: mime })

    const result = await generateImages({
      apiKey,
      baseURL,
      endpoint: normalizeImageEndpoint(rawEndpoint, true),
      prompt: args.prompt,
      model,
      size: args.size ?? "1024x1024",
      quality: args.quality ?? "auto",
      outputFormat,
      background: "auto",
      n: args.n ?? 1,
      imageFiles: [file],
    })

    if (!result.images.length) {
      return {
        isError: true,
        content: [{ type: "text", text: "上游未返回任何图片。" }],
      }
    }

    await saveServerRecord({
      prompt: args.prompt,
      endpoint: result.endpoint,
      model: result.model,
      outputFormat: result.outputFormat,
      quality: result.quality,
      size: result.size,
      images: result.images,
      sourceLabel: SOURCE_LABEL,
    })

    return {
      content: [
        {
          type: "text",
          text: `已基于参考图生成 ${result.images.length} 张图片，已保存到本地 generated 目录。`,
        },
        ...result.images.map((img) => toContentBlock(img.src)),
      ],
    }
  }
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // STDIO 模式下不要写 stdout（会污染协议），日志走 stderr
  console.error("[imgx-mcp] server started (stdio)")
}

main().catch((error) => {
  console.error("[imgx-mcp] fatal:", error)
  process.exit(1)
})
