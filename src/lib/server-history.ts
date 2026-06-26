import { promises as fs } from "node:fs"
import path from "node:path"

import type { GeneratedImage } from "@/lib/image-request"
import type { ServerHistoryRecord } from "@/lib/types"

/**
 * 服务端文件历史：MCP server 生成图片后落盘，网页经 /api/history 读取并合并展示。
 * 存储目录由环境变量 IMGX_OUTPUT_DIR 指定，默认项目根的 ./generated。
 */

/** saveServerRecord 入参 */
export type SaveServerRecordInput = {
  prompt: string
  endpoint: string
  model: string
  outputFormat: string
  quality: string
  size: string
  images: GeneratedImage[]
  /** 网页历史里展示的来源标签，如 "Claude Code" */
  sourceLabel?: string
}

const META_SUFFIX = ".json"

export function getOutputDir(): string {
  return process.env.IMGX_OUTPUT_DIR
    ? path.resolve(process.env.IMGX_OUTPUT_DIR)
    : path.join(process.cwd(), "generated")
}

/** 解析 data URL，返回二进制与扩展名；非 base64（如远程 http URL）返回 null */
function decodeDataUrl(src: string): { buffer: Buffer; ext: string } | null {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(src)
  if (!match) {
    return null
  }
  const ext = match[1].toLowerCase() === "jpeg" ? "jpg" : match[1].toLowerCase()
  return { buffer: Buffer.from(match[2], "base64"), ext }
}

/**
 * 保存一条生成记录：每张图解码落盘为文件，元数据写为单个 JSON。
 * 图片的 src 改写为 /api/history/file/<filename>，供网页直接当图片地址渲染；
 * 若 src 是远程 URL（无法解码），则原样保留。
 */
export async function saveServerRecord(
  input: SaveServerRecordInput
): Promise<ServerHistoryRecord> {
  const dir = getOutputDir()
  await fs.mkdir(dir, { recursive: true })

  const id = crypto.randomUUID()
  const createdAt = Date.now()

  const images: GeneratedImage[] = []
  for (let i = 0; i < input.images.length; i++) {
    const image = input.images[i]
    const decoded = decodeDataUrl(image.src)

    if (!decoded) {
      // 远程 URL 等无法落盘的情况，原样保留
      images.push(image)
      continue
    }

    const filename = `${id}-${i}.${decoded.ext}`
    await fs.writeFile(path.join(dir, filename), decoded.buffer)
    images.push({
      ...image,
      src: `/api/history/file/${filename}`,
    })
  }

  const record: ServerHistoryRecord = {
    id,
    createdAt,
    source: "mcp",
    response: {
      endpoint: input.endpoint,
      generation: createdAt,
      images,
      model: input.model,
      outputFormat: input.outputFormat,
      prompt: input.prompt,
      quality: input.quality,
      requestedCount: input.images.length,
      size: input.size,
      sourceLabel: input.sourceLabel,
    },
  }

  await fs.writeFile(
    path.join(dir, `${id}${META_SUFFIX}`),
    JSON.stringify(record, null, 2),
    "utf8"
  )

  return record
}

/** 读取全部服务端记录，按 createdAt 倒序（最新在前）。目录不存在时返回空数组。 */
export async function listServerRecords(): Promise<ServerHistoryRecord[]> {
  const dir = getOutputDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return []
  }

  const records: ServerHistoryRecord[] = []
  for (const entry of entries) {
    if (!entry.endsWith(META_SUFFIX)) {
      continue
    }
    try {
      const raw = await fs.readFile(path.join(dir, entry), "utf8")
      const parsed = JSON.parse(raw) as ServerHistoryRecord
      if (parsed && typeof parsed.id === "string" && parsed.response) {
        records.push(parsed)
      }
    } catch {
      // 跳过损坏的元数据文件
    }
  }

  return records.sort((a, b) => b.createdAt - a.createdAt)
}

/**
 * 删除一条服务端记录：移除元数据 JSON 及其所有同前缀的落盘图片文件。
 * 图片文件可能已丢失，逐个删除时容忍 ENOENT。
 * 返回 true 表示确实删除了元数据文件（记录存在）。
 */
export async function deleteServerRecord(id: string): Promise<boolean> {
  // 仅允许纯 id，防止路径穿越
  const safeId = path.basename(id)
  if (safeId !== id || safeId.includes("..") || safeId.length === 0) {
    return false
  }

  const dir = getOutputDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return false
  }

  const metaName = `${safeId}${META_SUFFIX}`
  // 元数据文件本身，以及所有 `<id>-*` 形式的图片文件
  const targets = entries.filter(
    (entry) => entry === metaName || entry.startsWith(`${safeId}-`)
  )

  let metaDeleted = false
  for (const entry of targets) {
    try {
      await fs.unlink(path.join(dir, entry))
      if (entry === metaName) {
        metaDeleted = true
      }
    } catch {
      // 文件可能已丢失，忽略
    }
  }

  return metaDeleted
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

/** 读取落盘的图片文件（含路径穿越防护）。不存在或非法返回 null。 */
export async function readImageFile(
  name: string
): Promise<{ data: Buffer; contentType: string } | null> {
  // 仅允许纯文件名，防止路径穿越
  const safe = path.basename(name)
  if (safe !== name || safe.includes("..")) {
    return null
  }

  const ext = path.extname(safe).slice(1).toLowerCase()
  const contentType = CONTENT_TYPES[ext]
  if (!contentType) {
    return null
  }

  try {
    const data = await fs.readFile(path.join(getOutputDir(), safe))
    return { data, contentType }
  } catch {
    return null
  }
}
