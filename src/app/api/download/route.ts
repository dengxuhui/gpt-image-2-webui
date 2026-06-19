import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const maxDuration = 30

/**
 * 服务端代理下载，解决前端 fetch 跨域图片的 CORS 问题。
 * GET /api/download?url=<encoded_url>&filename=<filename>
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")
  const filename = request.nextUrl.searchParams.get("filename") || "download"

  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 })
  }

  // 仅允许 http/https 协议，防止 SSRF
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(25_000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${response.status}` },
        { status: 502 }
      )
    }

    const contentType =
      response.headers.get("content-type") || "application/octet-stream"
    const body = Buffer.from(await response.arrayBuffer())

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}"`,
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch upstream image" },
      { status: 502 }
    )
  }
}
