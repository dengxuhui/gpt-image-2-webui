import { NextResponse } from "next/server"

import { deleteServerRecord, listServerRecords } from "@/lib/server-history"

export const runtime = "nodejs"

/** 返回服务端落盘的生成历史（MCP 生成的图片），供网页与浏览器本地历史合并展示。 */
export async function GET() {
  try {
    const records = await listServerRecords()
    return NextResponse.json({ records })
  } catch {
    return NextResponse.json({ records: [] })
  }
}

/** 删除一条服务端落盘记录（含元数据与图片文件），即使图片已丢失也能清除残留记录。 */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 })
  }

  try {
    const deleted = await deleteServerRecord(id)
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
