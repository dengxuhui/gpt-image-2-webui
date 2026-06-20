import type { GeneratedImage } from "@/lib/image-request"

/** 一次生成操作的完整结果 */
export type StudioResponse = {
  endpoint: string
  generation: number
  images: GeneratedImage[]
  model: string
  outputFormat: string
  prompt: string
  quality: string
  requestedCount: number
  size: string
  sourceLabel?: string
}

/** 上传预览（包含文件对象与浏览器本地 objectURL） */
export type UploadPreview = {
  file: File
  id: string
  url: string
}

/** 从生成结果中选中的“下一轮源图” */
export type ActiveSource = {
  label: string
  promptSnapshot: string
  round: number
  upload: UploadPreview
}

/** 服务端落盘的生成记录（由 MCP server 生成），经 GET /api/history 返回 */
export type ServerHistoryRecord = {
  id: string
  createdAt: number
  /** 来源标识，用于网页打来源徽章 */
  source: "mcp"
  response: StudioResponse
}

/** localStorage 中持久化的连接偏好 */
export type StoredConnectionPreferences = {
  version: 1
  remember: boolean
  apiKey: string
  endpoint: string
}
