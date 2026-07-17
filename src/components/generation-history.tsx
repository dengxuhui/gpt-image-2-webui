"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowDownToLineIcon,
  CheckIcon,
  ClockIcon,
  HistoryIcon,
  ImageIcon,
  Maximize2Icon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { GeneratedImage } from "@/lib/image-request"
import {
  type HistoryRecord,
  addRecord,
  clearAllRecords,
  collectFileNames,
  deleteRecord,
  deleteRecords,
  getAllRecords,
} from "@/lib/history-db"
import type { Locale, StudioMessages } from "@/lib/i18n"
import type { ServerHistoryRecord } from "@/lib/types"
import { cn, downloadImage } from "@/lib/utils"

/** 列表展示用记录：本地 IndexedDB 记录与服务端（MCP）记录的统一形状 */
type DisplayRecord = HistoryRecord & { source?: "mcp"; sourceLabel?: string }

// ---- 时间格式化 ----

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

  if (seconds < 60) return rtf.format(-seconds, "second")
  if (seconds < 3600) return rtf.format(-Math.floor(seconds / 60), "minute")
  if (seconds < 86400) return rtf.format(-Math.floor(seconds / 3600), "hour")
  if (seconds < 2592000) return rtf.format(-Math.floor(seconds / 86400), "day")
  if (seconds < 31536000) return rtf.format(-Math.floor(seconds / 2592000), "month")
  return rtf.format(-Math.floor(seconds / 31536000), "year")
}

function formatStorageMB(bytes: number): string {
  if (bytes < 1024 * 1024) {
    const kb = Math.round(bytes / 1024)
    return `${kb} KB`
  }
  const mb = Math.round((bytes / (1024 * 1024)) * 10) / 10
  return `${mb} MB`
}

// ---- Props ----

interface GenerationHistoryProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  locale: Locale
  text: StudioMessages
  onRestorePrompt: (prompt: string) => void
}

// ---- 主组件 ----

export function GenerationHistory({
  open,
  onOpenChange,
  locale,
  text,
  onRestorePrompt,
}: GenerationHistoryProps) {
  const [records, setRecords] = useState<HistoryRecord[]>([])
  const [serverRecords, setServerRecords] = useState<DisplayRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  /** 输出目录的磁盘占用；接口不可用时为 null（不展示用量） */
  const [diskBytes, setDiskBytes] = useState<number | null>(null)
  const [previewImage, setPreviewImage] = useState<{
    src: string
    alt: string
  } | null>(null)
  // 加载失败（资源丢失）的图片 src，用占位图代替破图
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())

  /** 拉取服务端（MCP）落盘历史与磁盘用量；网页独立运行时接口可能不可用，静默忽略 */
  const loadServerHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history")
      if (!res.ok) return

      const data: { records?: ServerHistoryRecord[]; diskBytes?: number } =
        await res.json()
      setServerRecords(
        (data.records ?? []).map((r) => ({
          ...r,
          source: "mcp" as const,
          sourceLabel: r.response.sourceLabel,
        }))
      )
      setDiskBytes(typeof data.diskBytes === "number" ? data.diskBytes : null)
    } catch {
      // 接口不可用，保持不展示用量
    }
  }, [])

  // Sheet 打开时加载数据
  useEffect(() => {
    if (!open) return

    async function load() {
      setLoading(true)
      try {
        setRecords(await getAllRecords())
      } catch {
        toast.error(text.historyLoadFailed)
      }

      await loadServerHistory()
      setLoading(false)
    }

    load()
  }, [open, text.historyLoadFailed, loadServerHistory])

  // Sheet 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setSelectionMode(false)
      setSelectedIds(new Set())
      setPreviewImage(null)
    }
  }, [open])

  // ---- 操作函数 ----

  /**
   * 删除记录对应的落盘图片，避免磁盘上留下孤儿文件。
   * 清理失败不影响本地记录删除（下次仍可重试或手动清理），故静默忽略。
   */
  const deleteFilesOnDisk = useCallback(async (targets: HistoryRecord[]) => {
    const names = collectFileNames(targets)
    if (names.length === 0) return

    try {
      await fetch("/api/history/file", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ names }),
      })
    } catch {
      // 磁盘清理失败，忽略
    }
  }, [])

  const handleDeleteOne = useCallback(
    async (id: string) => {
      const target = records.find((r) => r.id === id)
      await deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      if (target) {
        await deleteFilesOnDisk([target])
      }
      await loadServerHistory()
      toast.success(text.historyRecordDeleted)
    },
    [records, text.historyRecordDeleted, deleteFilesOnDisk, loadServerHistory]
  )

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return

    const ids = [...selectedIds]
    const targets = records.filter((r) => selectedIds.has(r.id))
    await deleteRecords(ids)
    setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    await deleteFilesOnDisk(targets)
    await loadServerHistory()
    toast.success(
      text.historyRecordsDeleted.replace("{count}", String(ids.length))
    )
  }, [
    records,
    selectedIds,
    text.historyRecordsDeleted,
    deleteFilesOnDisk,
    loadServerHistory,
  ])

  const handleDeleteServer = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        })
        if (!res.ok) {
          throw new Error(`Delete failed: ${res.status}`)
        }
        setServerRecords((prev) => prev.filter((r) => r.id !== id))
        await loadServerHistory()
        toast.success(text.historyRecordDeleted)
      } catch {
        toast.error(text.historyRecordDeleteFailed)
      }
    },
    [text.historyRecordDeleted, text.historyRecordDeleteFailed, loadServerHistory]
  )

  const handleImageError = useCallback((src: string) => {
    setFailedImages((prev) => {
      if (prev.has(src)) return prev
      const next = new Set(prev)
      next.add(src)
      return next
    })
  }, [])

  const handleClearAll = useCallback(async () => {
    const targets = records
    await clearAllRecords()
    setRecords([])
    setSelectedIds(new Set())
    setSelectionMode(false)
    await deleteFilesOnDisk(targets)
    await loadServerHistory()
    toast.success(text.historyAllCleared)
  }, [records, text.historyAllCleared, deleteFilesOnDisk, loadServerHistory])

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(records.map((r) => r.id)))
  }, [records])

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set())
    setSelectionMode(false)
  }, [])

  const handleDownload = useCallback(
    (image: GeneratedImage, index: number, format: string) => {
      downloadImage(image.src, `imgx-history-${index}.${format}`).catch(() =>
        toast.error(text.downloadFailed)
      )
    },
    [text.downloadFailed]
  )

  const handlePreview = useCallback(
    (image: GeneratedImage, record: HistoryRecord) => {
      setPreviewImage({
        src: image.src,
        alt:
          image.revisedPrompt ||
          record.response.prompt ||
          text.historyNoPrompt,
      })
    },
    [text.historyNoPrompt]
  )

  const handleRestorePrompt = useCallback(
    (prompt: string) => {
      onRestorePrompt(prompt)
      onOpenChange(false)
    },
    [onRestorePrompt, onOpenChange]
  )

  // ---- 渲染 ----

  const allSelected =
    records.length > 0 && selectedIds.size === records.length

  // 合并本地与服务端记录，按时间倒序展示
  const displayRecords: DisplayRecord[] = [...records, ...serverRecords].sort(
    (a, b) => b.createdAt - a.createdAt
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col sm:max-w-lg"
      >
        {/* 标题栏 */}
        <SheetHeader>
          <SheetTitle>{text.historyTitle}</SheetTitle>
          <SheetDescription>{text.historyDescription}</SheetDescription>
        </SheetHeader>

        {/* 工具栏 */}
        {records.length > 0 && !loading && (
          <div className="flex items-center gap-2 px-4">
            <span className="text-xs text-muted-foreground">
              {text.historyStorageInfo
                .replace("{count}", String(displayRecords.length))
                .replace("{suffix}", displayRecords.length !== 1 ? "s" : "")}
              {diskBytes !== null && ` · ${formatStorageMB(diskBytes)}`}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {!selectionMode ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSelectionMode(true)}
                >
                  <CheckIcon data-icon="inline-start" />
                  {text.historySelect}
                </Button>
              ) : (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={allSelected ? handleDeselectAll : handleSelectAll}
                  >
                    {allSelected ? text.historyDeselect : text.historySelect}{" "}
                    {selectedIds.size > 0 && !allSelected
                      ? `(${selectedIds.size})`
                      : ""}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-destructive hover:text-destructive"
                    onClick={handleDeleteSelected}
                    disabled={selectedIds.size === 0}
                  >
                    <Trash2Icon data-icon="inline-start" />
                    {text.historyDeleteSelected}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        <Separator className="mx-4" />

        {/* 内容区 */}
        <div className="flex-1 overflow-y-auto px-4">
          {loading ? (
            <div className="space-y-3 py-2">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="flex gap-3 rounded-lg border p-3">
                  <Skeleton className="size-20 shrink-0 rounded-md" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : displayRecords.length === 0 ? (
            <div className="flex h-full items-center justify-center py-12">
              <Empty>
                <EmptyHeader>
                  <HistoryIcon className="size-10 text-muted-foreground/40" />
                  <EmptyTitle>{text.historyEmptyTitle}</EmptyTitle>
                  <EmptyDescription>
                    {text.historyEmptyDescription}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            </div>
          ) : previewImage ? (
            /* 大图预览 */
            <div className="flex flex-col gap-3 py-3">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPreviewImage(null)}
                >
                  <XIcon />
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  {previewImage.alt}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border bg-muted/20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  alt={previewImage.alt}
                  className="w-full object-contain"
                  src={previewImage.src}
                />
              </div>
            </div>
          ) : (
            /* 历史记录列表 */
            <div className="space-y-2 py-2">
              {displayRecords.map((record) => {
                const firstImage = record.response.images[0]
                const promptPreview =
                  record.response.prompt || text.historyNoPrompt
                const isServer = record.source === "mcp"
                const isSelected = selectedIds.has(record.id)
                // 图片资源已丢失（如服务端文件被删）：用占位图代替破图
                const imageLost = firstImage
                  ? failedImages.has(firstImage.src)
                  : false

                return (
                  <div
                    key={record.id}
                    className={cn(
                      "group relative flex gap-3 rounded-lg border p-3 transition-colors",
                      selectionMode && isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "hover:bg-muted/50"
                    )}
                  >
                    {/* 选择框覆盖（服务端记录为只读，不参与选择） */}
                    {selectionMode && !isServer && (
                      <button
                        type="button"
                        className="absolute inset-0 z-10 cursor-pointer"
                        aria-label={
                          isSelected ? text.historyDeselect : text.historySelect
                        }
                        onClick={() => toggleSelect(record.id)}
                      />
                    )}

                    {/* 缩略图 */}
                    <div
                      className={cn(
                        "relative z-0 size-20 shrink-0 overflow-hidden rounded-md border bg-muted",
                        selectionMode && !isServer && "pointer-events-none"
                      )}
                    >
                      {firstImage && !imageLost ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={promptPreview.slice(0, 40)}
                          className="size-full object-cover"
                          loading="lazy"
                          src={firstImage.src}
                          onError={() => handleImageError(firstImage.src)}
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center">
                          <ImageIcon className="size-6 text-muted-foreground/40" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute inset-0 flex items-center justify-center bg-primary/20">
                          <CheckIcon className="size-5 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* 信息区 */}
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <p className="truncate text-xs font-medium leading-tight">
                        {promptPreview}
                      </p>
                      <div className="flex flex-wrap items-center gap-1">
                        {isServer && (
                          <Badge className="text-[10px]" variant="default">
                            {record.sourceLabel || "Claude Code"}
                          </Badge>
                        )}
                        <Badge
                          className="text-[10px]"
                          variant="secondary"
                        >
                          {record.response.model}
                        </Badge>
                        <Badge
                          className="text-[10px]"
                          variant="secondary"
                        >
                          {record.response.size}
                        </Badge>
                        <Badge
                          className="text-[10px]"
                          variant="secondary"
                        >
                          {record.response.outputFormat.toUpperCase()}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          ×{record.response.images.length}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <ClockIcon className="size-3" />
                        {formatTimeAgo(record.createdAt)}
                      </span>

                      {/* 操作按钮 */}
                      <div
                        className={cn(
                          "mt-1 flex items-center gap-1",
                          selectionMode && !isServer && "pointer-events-none opacity-0"
                        )}
                      >
                        {firstImage && !imageLost && (
                          <>
                            <Button
                              size="xs"
                              variant="secondary"
                              className="h-6 rounded-md px-1.5 text-[10px]"
                              onClick={() =>
                                handleDownload(
                                  firstImage,
                                  1,
                                  record.response.outputFormat
                                )
                              }
                            >
                              <ArrowDownToLineIcon data-icon="inline-start" />
                              {text.save || "Save"}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="h-6 rounded-md px-1.5 text-[10px]"
                              onClick={() =>
                                handlePreview(firstImage, record)
                              }
                            >
                              <Maximize2Icon data-icon="inline-start" />
                            </Button>
                          </>
                        )}
                        {record.response.prompt && (
                          <Button
                            size="xs"
                            variant="ghost"
                            className="h-6 rounded-md px-1.5 text-[10px]"
                            onClick={() =>
                              handleRestorePrompt(record.response.prompt)
                            }
                            title={text.historyRestorePrompt}
                          >
                            {text.historyRestorePrompt}
                          </Button>
                        )}
                        <Button
                          size="xs"
                          variant="ghost"
                          className="ml-auto h-6 rounded-md px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                          onClick={() =>
                            isServer
                              ? handleDeleteServer(record.id)
                              : handleDeleteOne(record.id)
                          }
                        >
                          <Trash2Icon data-icon="inline-start" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {records.length > 0 && !loading && (
          <SheetFooter>
            <Separator />
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-muted-foreground">
                {text.historyStorageInfo
                  .replace("{count}", String(displayRecords.length))
                  .replace("{suffix}", displayRecords.length !== 1 ? "s" : "")}
                {diskBytes !== null && ` · ${formatStorageMB(diskBytes)}`}
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="h-7 text-xs"
                onClick={handleClearAll}
              >
                <Trash2Icon data-icon="inline-start" />
                {text.historyClearAll}
              </Button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  )
}

// 重新导出 addRecord 方便 image-studio 调用
export { addRecord, getAllRecords } from "@/lib/history-db"
