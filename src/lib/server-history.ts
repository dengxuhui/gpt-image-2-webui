import { promises as fs } from "node:fs"
import path from "node:path"

import { HISTORY_FILE_PREFIX } from "@/lib/constants"
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

/** 落盘图片支持的扩展名 → Content-Type */
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
}

/** 远程图片下载超时 */
const FETCH_TIMEOUT_MS = 30_000

/** 归一化扩展名；不受支持时回退 png，保证落盘文件可被 readImageFile 提供 */
function normalizeExt(value: string): string {
  const ext = value.toLowerCase().replace(/^\./, "")
  const normalized = ext === "jpeg" ? "jpg" : ext
  return CONTENT_TYPES[normalized] ? normalized : "png"
}

/** 解析 data URL，返回二进制与扩展名；非 base64（如远程 http URL）返回 null */
function decodeDataUrl(src: string): { buffer: Buffer; ext: string } | null {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,([\s\S]+)$/.exec(src)
  if (!match) {
    return null
  }
  return { buffer: Buffer.from(match[2], "base64"), ext: normalizeExt(match[1]) }
}

/**
 * 下载远程图片（上游返回 url 而非 b64_json 时走这里）。
 * 这类链接会过期，不落盘则历史记录迟早裂图。失败返回 null，由调用方保留原 src。
 */
async function downloadRemoteImage(
  src: string,
  outputFormat: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  if (!/^https?:\/\//.test(src)) {
    return null
  }

  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
    if (!res.ok) {
      return null
    }

    const buffer = Buffer.from(await res.arrayBuffer())
    if (buffer.length === 0) {
      return null
    }

    // 明确不是图片（如上游返回 HTML 错误页）就别落盘，否则只是把裂图换个地方存
    const contentType = res.headers.get("content-type")?.split(";")[0].trim()
    if (contentType && !contentType.startsWith("image/")) {
      return null
    }

    // 优先信任响应头，缺失时回退到请求时指定的输出格式
    const subtype = contentType
      ? contentType.slice("image/".length)
      : outputFormat

    return { buffer, ext: normalizeExt(subtype) }
  } catch {
    return null
  }
}

/**
 * 把生成结果里的图片全部落盘到输出目录，src 改写为 /api/history/file/<filename>。
 * data URL 直接解码，远程 URL 先下载；单张失败时原样保留其 src，不影响其余图片。
 * baseId 用于文件名前缀，deleteServerRecord 据此清理同一条记录的所有图片。
 */
export async function persistImages(
  images: GeneratedImage[],
  outputFormat: string,
  baseId: string = crypto.randomUUID()
): Promise<GeneratedImage[]> {
  if (images.length === 0) {
    return images
  }

  const dir = getOutputDir()
  await fs.mkdir(dir, { recursive: true })

  const persisted: GeneratedImage[] = []
  for (let i = 0; i < images.length; i++) {
    const image = images[i]
    const decoded =
      decodeDataUrl(image.src) ?? (await downloadRemoteImage(image.src, outputFormat))

    if (!decoded) {
      persisted.push(image)
      continue
    }

    const filename = `${baseId}-${i}.${decoded.ext}`
    try {
      await fs.writeFile(path.join(dir, filename), decoded.buffer)
      persisted.push({ ...image, src: `${HISTORY_FILE_PREFIX}${filename}` })
    } catch {
      persisted.push(image)
    }
  }

  return persisted
}

/**
 * 保存一条生成记录：每张图落盘为文件（见 persistImages），元数据写为单个 JSON。
 */
export async function saveServerRecord(
  input: SaveServerRecordInput
): Promise<ServerHistoryRecord> {
  const dir = getOutputDir()
  await fs.mkdir(dir, { recursive: true })

  const id = crypto.randomUUID()
  const createdAt = Date.now()

  const images = await persistImages(input.images, input.outputFormat, id)

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

/**
 * 校验文件名并解析为输出目录内的绝对路径。
 * 仅允许纯文件名（防路径穿越）且扩展名在图片白名单内——后者同时保证
 * 删除接口碰不到元数据 JSON。非法返回 null。
 */
function resolveImagePath(
  name: string
): { path: string; contentType: string } | null {
  const safe = path.basename(name)
  if (safe !== name || safe.includes("..")) {
    return null
  }

  const contentType = CONTENT_TYPES[path.extname(safe).slice(1).toLowerCase()]
  if (!contentType) {
    return null
  }

  return { path: path.join(getOutputDir(), safe), contentType }
}

/** 读取落盘的图片文件（含路径穿越防护）。不存在或非法返回 null。 */
export async function readImageFile(
  name: string
): Promise<{ data: Buffer; contentType: string } | null> {
  const resolved = resolveImagePath(name)
  if (!resolved) {
    return null
  }

  try {
    const data = await fs.readFile(resolved.path)
    return { data, contentType: resolved.contentType }
  } catch {
    return null
  }
}

/**
 * 删除指定的落盘图片文件，返回实际删除的数量。
 * 供网页删除浏览器历史记录时同步清理磁盘，避免留下孤儿文件。
 * 文件可能已丢失，逐个删除时容忍 ENOENT。
 */
export async function deleteImageFiles(names: string[]): Promise<number> {
  let deleted = 0

  for (const name of names) {
    const resolved = resolveImagePath(name)
    if (!resolved) {
      continue
    }

    try {
      await fs.unlink(resolved.path)
      deleted++
    } catch {
      // 文件已丢失，忽略
    }
  }

  return deleted
}

/** 统计输出目录的磁盘占用（字节）。目录不存在时返回 0。 */
export async function getDiskUsage(): Promise<number> {
  const dir = getOutputDir()
  let entries: string[]
  try {
    entries = await fs.readdir(dir)
  } catch {
    return 0
  }

  let total = 0
  for (const entry of entries) {
    try {
      const stat = await fs.stat(path.join(dir, entry))
      if (stat.isFile()) {
        total += stat.size
      }
    } catch {
      // 文件可能在统计期间被删除，忽略
    }
  }

  return total
}
