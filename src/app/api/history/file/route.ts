import { NextResponse } from "next/server"

import { deleteImageFiles } from "@/lib/server-history"

export const runtime = "nodejs"

/**
 * 批量删除落盘图片文件（body: { names: string[] }）。
 * 网页删除浏览器本地历史记录时调用，同步清理磁盘上的图片，避免留下孤儿文件。
 * 记录可能有多张图，故做成批量接口，清空历史时也只需一次请求。
 * MCP 记录请走 DELETE /api/history?id=，那里会连同元数据 JSON 一起删。
 */
export async function DELETE(request: Request) {
  let names: unknown
  try {
    names = (await request.json())?.names
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 })
  }

  if (!Array.isArray(names) || names.some((n) => typeof n !== "string")) {
    return NextResponse.json({ error: "Invalid names" }, { status: 400 })
  }

  try {
    const deleted = await deleteImageFiles(names as string[])
    return NextResponse.json({ deleted })
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
