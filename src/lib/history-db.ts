import { openDB, type IDBPDatabase } from "idb"

import { getHistoryFileName } from "@/lib/constants"
import type { StudioResponse } from "@/lib/types"

// ---- 类型 ----

export interface HistoryRecord {
  id: string
  createdAt: number
  response: StudioResponse
}

// ---- 内部常量 ----

const DB_NAME = "imgx-history"
const DB_VERSION = 1
const STORE_NAME = "generations"

// ---- 内部辅助 ----

function getDB(): Promise<IDBPDatabase> {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("createdAt", "createdAt")
      }
    },
  })
}

/**
 * 保存记录，遇到 QuotaExceededError 时按 LRU 驱逐旧记录后重试。
 * 返回 true 表示保存成功，false 表示所有重试均失败。
 */
async function saveWithRetry(record: HistoryRecord): Promise<boolean> {
  const db = await getDB()

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await db.add(STORE_NAME, record)
      return true
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "QuotaExceededError"
      ) {
        const all = await db.getAllFromIndex(STORE_NAME, "createdAt")
        if (all.length === 0) {
          return false // 无旧记录可删
        }

        const deleteCount =
          attempt === 0
            ? Math.min(5, all.length) // 首次尝试：删最旧 5 条
            : Math.ceil(all.length / 2) // 后续尝试：删一半

        const toDelete = all.slice(0, deleteCount)
        const tx = db.transaction(STORE_NAME, "readwrite")
        await Promise.all([
          ...toDelete.map((r) => tx.store.delete(r.id)),
          tx.done,
        ])
      } else {
        throw err
      }
    }
  }

  return false
}

// ---- 公开 API ----

/** 保存一条生成记录。存储空间不足时自动驱逐旧记录，均失败返回 null。 */
export async function addRecord(
  response: StudioResponse
): Promise<HistoryRecord | null> {
  const record: HistoryRecord = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    response,
  }

  const saved = await saveWithRetry(record)
  return saved ? record : null
}

/** 获取所有记录，按创建时间倒序（最新在前）。 */
export async function getAllRecords(): Promise<HistoryRecord[]> {
  const db = await getDB()
  const raw = await db.getAllFromIndex(STORE_NAME, "createdAt")
  return raw.reverse() // getAllFromIndex 按索引升序返回，反转得最新在前
}

/** 获取单条记录。 */
export async function getRecord(
  id: string
): Promise<HistoryRecord | undefined> {
  const db = await getDB()
  return db.get(STORE_NAME, id)
}

/** 删除单条记录。 */
export async function deleteRecord(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

/** 批量删除记录（在单个事务中完成）。 */
export async function deleteRecords(ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return
  }

  const db = await getDB()
  const tx = db.transaction(STORE_NAME, "readwrite")
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
}

/** 清空全部记录。 */
export async function clearAllRecords(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}

/**
 * 收集记录中所有落盘图片的文件名，供服务端同步删除磁盘文件（跳过未落盘的远程 URL）。
 *
 * 存储用量不在这里统计：图片二进制存在服务端磁盘上，IndexedDB 只存
 * /api/history/file/ 路径，按 src 长度估算会得出接近 0 的误导性结果。
 * 用量由 GET /api/history 的 diskBytes 提供。
 */
export function collectFileNames(records: HistoryRecord[]): string[] {
  return records.flatMap((record) =>
    record.response.images
      .map((image) => getHistoryFileName(image.src))
      .filter((name): name is string => name !== null)
  )
}
