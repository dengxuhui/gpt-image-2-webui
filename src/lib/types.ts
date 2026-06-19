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

/** localStorage 中持久化的连接偏好 */
export type StoredConnectionPreferences = {
  version: 1
  remember: boolean
  apiKey: string
  endpoint: string
}
