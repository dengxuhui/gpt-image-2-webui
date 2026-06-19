import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// File System Access API 的最小类型（避免依赖 lib.dom 版本差异）
type SaveFilePickerFn = (options?: {
  suggestedName?: string
  types?: { description?: string; accept: Record<string, string[]> }[]
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}>

function getSaveFilePicker(): SaveFilePickerFn | undefined {
  if (typeof window === "undefined") return undefined
  return (window as unknown as { showSaveFilePicker?: SaveFilePickerFn })
    .showSaveFilePicker
}

function mimeFromFilename(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "png":
      return "image/png"
    case "jpg":
    case "jpeg":
      return "image/jpeg"
    case "webp":
      return "image/webp"
    default:
      return "application/octet-stream"
  }
}

/** 获取图片二进制：跨域 HTTP URL 走服务端代理避免 CORS，data:/blob: 直接 fetch。 */
async function fetchImageBlob(src: string): Promise<Blob> {
  const url =
    src.startsWith("http://") || src.startsWith("https://")
      ? `/api/download?url=${encodeURIComponent(src)}`
      : src

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`)
  }
  return response.blob()
}

/**
 * 下载图片到本地。
 * - 支持 File System Access API 的浏览器（Chrome/Edge）→ 弹出"另存为"对话框让用户选择保存位置
 * - 其他浏览器（Safari/Firefox）→ 回退到 <a download>，跨域 URL 经服务端代理
 */
export async function downloadImage(src: string, filename: string): Promise<void> {
  const showSaveFilePicker = getSaveFilePicker()

  // 现代浏览器：先弹保存对话框（瞬间），用户选完位置后再拉取数据
  if (showSaveFilePicker) {
    const mime = mimeFromFilename(filename)
    const ext = filename.includes(".") ? `.${filename.split(".").pop()}` : ""

    let handle
    try {
      handle = await showSaveFilePicker({
        suggestedName: filename,
        types: ext ? [{ accept: { [mime]: [ext] } }] : undefined,
      })
    } catch (err) {
      // 用户取消保存对话框 → 静默返回，不视为失败
      if (err instanceof DOMException && err.name === "AbortError") return
      throw err
    }

    const blob = await fetchImageBlob(src)
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return
  }

  // 回退：传统 <a download>
  const downloadUrl =
    src.startsWith("http://") || src.startsWith("https://")
      ? `/api/download?url=${encodeURIComponent(src)}&filename=${encodeURIComponent(filename)}`
      : src

  const a = document.createElement("a")
  a.href = downloadUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => document.body.removeChild(a), 200)
}
