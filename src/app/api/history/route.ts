import { NextResponse } from "next/server"

import { listServerRecords } from "@/lib/server-history"

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
