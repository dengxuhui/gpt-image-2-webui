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
  deleteRecord,
  deleteRecords,
  getAllRecords,
  getStorageEstimate,
} from "@/lib/history-db"
import type { Locale, StudioMessages } from "@/lib/i18n"
import type { StudioResponse } from "@/lib/types"
import { cn, downloadImage } from "@/lib/utils"

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
  const [loading, setLoading] = useState(true)
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [storageInfo, setStorageInfo] = useState<{
    recordCount: number
    estimatedBytes: number
  } | null>(null)
  const [previewImage, setPreviewImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  // Sheet 打开时加载数据
  useEffect(() => {
    if (!open) return

    async function load() {
      setLoading(true)
      try {
        const [all, info] = await Promise.all([
          getAllRecords(),
          getStorageEstimate(),
        ])
        setRecords(all)
        if (info.recordCount > 0) {
          setStorageInfo(info)
        } else {
          setStorageInfo(null)
        }
      } catch {
        toast.error(text.historyLoadFailed)
      }
      setLoading(false)
    }

    load()
  }, [open, text.historyLoadFailed])

  // Sheet 关闭时重置状态
  useEffect(() => {
    if (!open) {
      setSelectionMode(false)
      setSelectedIds(new Set())
      setPreviewImage(null)
    }
  }, [open])

  // ---- 操作函数 ----

  const refreshStorageInfo = useCallback(async () => {
    const info = await getStorageEstimate()
    setStorageInfo(info.recordCount > 0 ? info : null)
  }, [])

  const handleDeleteOne = useCallback(
    async (id: string) => {
      await deleteRecord(id)
      setRecords((prev) => prev.filter((r) => r.id !== id))
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await refreshStorageInfo()
      toast.success(text.historyRecordDeleted)
    },
    [text.historyRecordDeleted, refreshStorageInfo]
  )

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return

    const ids = [...selectedIds]
    await deleteRecords(ids)
    setRecords((prev) => prev.filter((r) => !selectedIds.has(r.id)))
    setSelectedIds(new Set())
    setSelectionMode(false)
    await refreshStorageInfo()
    toast.success(
      text.historyRecordsDeleted.replace("{count}", String(ids.length))
    )
  }, [selectedIds, text.historyRecordsDeleted, refreshStorageInfo])

  const handleClearAll = useCallback(async () => {
    await clearAllRecords()
    setRecords([])
    setSelectedIds(new Set())
    setSelectionMode(false)
    setStorageInfo(null)
    toast.success(text.historyAllCleared)
  }, [text.historyAllCleared])

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
            {storageInfo && (
              <span className="text-xs text-muted-foreground">
                {text.historyStorageInfo
                  .replace("{count}", String(storageInfo.recordCount))
                  .replace(
                    "{suffix}",
                    storageInfo.recordCount !== 1 ? "s" : ""
                  )}{" "}
                · {formatStorageMB(storageInfo.estimatedBytes)}
              </span>
            )}
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
          ) : records.length === 0 ? (
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
              {records.map((record) => {
                const firstImage = record.response.images[0]
                const promptPreview =
                  record.response.prompt || text.historyNoPrompt
                const isSelected = selectedIds.has(record.id)

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
                    {/* 选择框覆盖 */}
                    {selectionMode && (
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
                        selectionMode && "pointer-events-none"
                      )}
                    >
                      {firstImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          alt={promptPreview.slice(0, 40)}
                          className="size-full object-cover"
                          loading="lazy"
                          src={firstImage.src}
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
                          selectionMode && "pointer-events-none opacity-0"
                        )}
                      >
                        {firstImage && (
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
                          onClick={() => handleDeleteOne(record.id)}
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
                  .replace("{count}", String(storageInfo?.recordCount ?? records.length))
                  .replace(
                    "{suffix}",
                    (storageInfo?.recordCount ?? 0) !== 1 ? "s" : ""
                  )}
                {storageInfo &&
                  ` · ${formatStorageMB(storageInfo.estimatedBytes)}`}
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
