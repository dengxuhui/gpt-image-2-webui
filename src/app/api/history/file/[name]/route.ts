import { NextResponse } from "next/server"

import { readImageFile } from "@/lib/server-history"

export const runtime = "nodejs"

/** 流式返回 generated 目录下落盘的图片文件（带路径穿越防护）。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const file = await readImageFile(decodeURIComponent(name))

  if (!file) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  })
}
