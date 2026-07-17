/** 单张图片最大字节数 */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** 落盘图片的访问路径前缀：服务端据此改写 src，客户端据此反解文件名 */
export const HISTORY_FILE_PREFIX = "/api/history/file/"

/**
 * 从生成结果的 src 中取出落盘文件名；非落盘图片（如上游远程 URL）返回 null。
 */
export function getHistoryFileName(src: string): string | null {
  if (!src.startsWith(HISTORY_FILE_PREFIX)) {
    return null
  }

  const name = decodeURIComponent(src.slice(HISTORY_FILE_PREFIX.length))
  return name.length > 0 && !name.includes("/") ? name : null
}

/** 自定义尺寸单边最小值 */
export const MIN_CUSTOM_DIMENSION = 64

/** 自定义尺寸单边最大值 */
export const MAX_CUSTOM_DIMENSION = 8192

/** 默认尺寸 */
export const DEFAULT_SIZE = "1024x1024"

/** 自定义尺寸默认占位值 */
export const DEFAULT_CUSTOM_SIZE = "1280x720"

/** 支持的图片 MIME 类型 */
export const SUPPORTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
])

/** 文生图（generations）支持的尺寸 */
export const GENERATE_SIZE_VALUES = new Set([
  "auto",
  "256x256",
  "512x512",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "1792x1024",
  "1024x1792",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
])

/** 图生图（edits）支持的尺寸 */
export const EDIT_SIZE_VALUES = new Set([
  "auto",
  "256x256",
  "512x512",
  "1024x1024",
  "1536x1024",
  "1024x1536",
  "2048x2048",
  "2048x1152",
  "3840x2160",
  "2160x3840",
])

/**
 * 归一化自定义尺寸输入。
 * - 去除空格、中文乘号 → 半角 x
 * - 校验范围 64–8192
 * - 有效时返回 "WxH"，无效返回空字符串
 */
export function normalizeCustomSize(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, "").replace(/×/g, "x")
  const match = /^([1-9]\d{1,4})x([1-9]\d{1,4})$/.exec(normalized)

  if (!match) {
    return ""
  }

  const width = Number(match[1])
  const height = Number(match[2])

  if (
    width < MIN_CUSTOM_DIMENSION ||
    width > MAX_CUSTOM_DIMENSION ||
    height < MIN_CUSTOM_DIMENSION ||
    height > MAX_CUSTOM_DIMENSION
  ) {
    return ""
  }

  return `${width}x${height}`
}
