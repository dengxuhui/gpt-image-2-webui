import OpenAI from "openai"

import {
  extractGeneratedImages,
  type GeneratedImage,
  getPayloadField,
} from "@/lib/image-request"

/** 生图核心入参（已解析为普通对象，与 FormData 无关，供 route.ts 与 MCP server 共用） */
export type GenerateImagesInput = {
  apiKey: string
  baseURL: string
  endpoint: string
  prompt: string
  model: string
  size: string
  quality: string
  outputFormat: string
  background: string
  n: number
  /** 参考图（图生图）；为空则走文生图 */
  imageFiles?: File[]
}

/** 生图核心结果（route.ts 据此拼 HTTP 响应；MCP server 据此落盘） */
export type GenerateImagesResult = {
  images: GeneratedImage[]
  endpoint: string
  model: string
  outputFormat: string
  quality: string
  size: string
  background?: unknown
  created?: unknown
  usage?: unknown
}

/**
 * 调用 OpenAI 兼容 Image API 生成图片。
 * 有参考图走 images.edit（仅取第一张），否则走 images.generate。
 * 不做入参校验（交由调用方），只负责请求与容错解析。
 */
export async function generateImages(
  input: GenerateImagesInput
): Promise<GenerateImagesResult> {
  const {
    apiKey,
    baseURL,
    endpoint,
    prompt,
    model,
    size,
    quality,
    outputFormat,
    background,
    n,
    imageFiles = [],
  } = input

  const client = new OpenAI({ apiKey, baseURL, maxRetries: 0 })
  let payload: unknown

  if (imageFiles.length) {
    // images.edit 仅接受单张图片，多张参考图时只取第一张
    payload = await client.images.edit({
      background: background as OpenAI.Images.ImageEditParams["background"],
      image: imageFiles[0],
      model,
      n,
      output_format: outputFormat as OpenAI.Images.ImageEditParams["output_format"],
      prompt,
      quality: quality as OpenAI.Images.ImageEditParams["quality"],
      size: size as OpenAI.Images.ImageEditParams["size"],
    })
  } else {
    payload = await client.images.generate({
      background: background as OpenAI.Images.ImageGenerateParams["background"],
      model,
      n,
      output_format: outputFormat as OpenAI.Images.ImageGenerateParams["output_format"],
      prompt,
      quality: quality as OpenAI.Images.ImageGenerateParams["quality"],
      size: size as OpenAI.Images.ImageGenerateParams["size"],
    })
  }

  const images = extractGeneratedImages(payload, outputFormat)

  return {
    images,
    endpoint,
    model,
    outputFormat,
    quality: (getPayloadField(payload, "quality") as string) || quality,
    size: (getPayloadField(payload, "size") as string) || size,
    background: getPayloadField(payload, "background"),
    created: getPayloadField(payload, "created"),
    usage: getPayloadField(payload, "usage"),
  }
}
