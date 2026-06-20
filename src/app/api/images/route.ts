import OpenAI from "openai"
import { NextResponse } from "next/server"

import {
  DEFAULT_SIZE,
  EDIT_SIZE_VALUES,
  GENERATE_SIZE_VALUES,
  MAX_FILE_BYTES,
  normalizeCustomSize,
  SUPPORTED_IMAGE_TYPES,
} from "@/lib/constants"
import { generateImages } from "@/lib/generate-image"
import { resolveLocale, t } from "@/lib/i18n"
import {
  getImageApiError,
  normalizeImageEndpoint,
  normalizeOpenAIBaseURL,
} from "@/lib/image-request"

export const runtime = "nodejs"
export const maxDuration = 120

function getText(formData: FormData, key: string, fallback = "") {
  const value = formData.get(key)

  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function getBackground(formData: FormData) {
  const value = getText(formData, "background", "auto")
  return value === "transparent" || value === "opaque" || value === "auto" ? value : "auto"
}

function getOutputFormat(formData: FormData) {
  const value = getText(formData, "outputFormat", "png")
  return value === "jpeg" || value === "webp" || value === "png" ? value : "png"
}

function getGenerateQuality(formData: FormData) {
  const value = getText(formData, "quality", "auto")
  return value === "auto" || value === "low" || value === "medium" || value === "high" || value === "standard" || value === "hd"
    ? value
    : "auto"
}

function getSize(formData: FormData, supportedSizes: Set<string>) {
  const value = getText(formData, "size", DEFAULT_SIZE)
  const custom = normalizeCustomSize(value)

  if (supportedSizes.has(value)) {
    return value
  }

  return custom || DEFAULT_SIZE
}

function getEditQuality(formData: FormData) {
  const value = getText(formData, "quality", "auto")
  return value === "auto" || value === "low" || value === "medium" || value === "high" || value === "standard"
    ? value
    : "auto"
}

function getGenerateSize(formData: FormData) {
  return getSize(formData, GENERATE_SIZE_VALUES)
}

function getEditSize(formData: FormData) {
  return getSize(formData, EDIT_SIZE_VALUES)
}

export async function POST(request: Request) {
  let locale = resolveLocale(request.headers.get("accept-language"))
  let endpoint = ""

  try {
    const incomingFormData = await request.formData()
    locale = resolveLocale(
      ((): string => {
        const value = incomingFormData.get("locale")
        return typeof value === "string" && value.trim()
          ? value.trim()
          : request.headers.get("accept-language") || ""
      })()
    )
    const apiKey = getText(incomingFormData, "apiKey", process.env.OPENAI_API_KEY || "")
    const prompt = getText(incomingFormData, "prompt")

    if (!apiKey) {
      return NextResponse.json({ error: t(locale, "proxyApiKeyRequired") }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ error: t(locale, "proxyPromptRequired") }, { status: 400 })
    }

    const images = incomingFormData
      .getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0)

    for (const image of images) {
      if (!SUPPORTED_IMAGE_TYPES.has(image.type)) {
        return NextResponse.json(
          { error: t(locale, "proxyUnsupportedImageFormat", { name: image.name }) },
          { status: 400 }
        )
      }

      if (image.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { error: t(locale, "proxyImageTooLarge", { name: image.name }) },
          { status: 400 }
        )
      }
    }

    const model = getText(incomingFormData, "model", "gpt-image-2")
    endpoint = normalizeImageEndpoint(getText(incomingFormData, "endpoint"), images.length > 0, locale)
    const baseURL = normalizeOpenAIBaseURL(getText(incomingFormData, "endpoint"), locale)
    const outputFormat = getOutputFormat(incomingFormData)
    const imageCount = Number(getText(incomingFormData, "imageCount", "1"))
    const background = getBackground(incomingFormData)
    const n = Math.min(Math.max(imageCount, 1), 4)
    const quality = images.length ? getEditQuality(incomingFormData) : getGenerateQuality(incomingFormData)
    const size = images.length ? getEditSize(incomingFormData) : getGenerateSize(incomingFormData)

    const result = await generateImages({
      apiKey,
      background,
      baseURL,
      endpoint,
      imageFiles: images,
      model,
      n,
      outputFormat,
      prompt,
      quality,
      size,
    })

    if (!result.images.length) {
      return NextResponse.json(
        {
          endpoint,
          error: t(locale, "proxyNoImageField"),
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      background: result.background,
      created: result.created,
      endpoint,
      images: result.images,
      model,
      outputFormat,
      quality: result.quality,
      size: result.size,
      usage: result.usage,
    })
  } catch (error) {
    if (error instanceof OpenAI.APIError) {
      return NextResponse.json(
        {
          endpoint,
          error: getImageApiError(error.error) || error.message || t(locale, "proxyRequestFailed", { status: error.status || 500 }),
        },
        { status: error.status || 500 }
      )
    }

    return NextResponse.json(
      {
        endpoint,
        error: error instanceof Error ? error.message : t(locale, "proxyGenerationFailed"),
      },
      { status: 500 }
    )
  }
}
