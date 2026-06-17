import {
  apiFetch,
  getApiRequestHeaders,
  toApiUrl,
} from "@/lib/api"

type ImageAsset = {
  byteSize: number
  contentType: string
  filename: string
  id: string
  status: string
}

type ImageUploadTarget = {
  expiresAt: string
  headers: Record<string, string>
  method: "PUT"
  storageMode: "s3" | "binding"
  url: string
}

type CreateImageUploadResponse = {
  asset: ImageAsset
  upload: ImageUploadTarget
}

type CompleteImageUploadResponse = {
  asset: ImageAsset
}

export type UploadWorkspaceImageInput = {
  databaseId?: string | null
  file: File
  organizationId: string
  workspaceId: string
}

export type UploadedWorkspaceImage = {
  asset: ImageAsset
  url: string
}

export async function uploadWorkspaceImage({
  databaseId,
  file,
  organizationId,
  workspaceId,
}: UploadWorkspaceImageInput): Promise<UploadedWorkspaceImage> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image uploads are supported.")
  }

  const { asset, upload } = await apiFetch<CreateImageUploadResponse>(
    "/images/uploads",
    {
      body: JSON.stringify({
        byteSize: file.size,
        contentType: file.type,
        databaseId: databaseId || undefined,
        filename: file.name,
        organizationId,
        workspaceId,
      }),
      method: "POST",
    },
  )

  await putImageBody(upload, file)

  const completed = await apiFetch<CompleteImageUploadResponse>(
    `/images/uploads/${encodeURIComponent(asset.id)}/complete`,
    {
      method: "POST",
    },
  )

  return {
    asset: completed.asset,
    url: toApiUrl(`/images/${encodeURIComponent(completed.asset.id)}`),
  }
}

async function putImageBody(upload: ImageUploadTarget, file: File) {
  const headers =
    upload.storageMode === "binding"
      ? getApiRequestHeaders(upload.headers)
      : new Headers(upload.headers)
  const response = await fetch(getUploadUrl(upload), {
    body: file,
    credentials: upload.storageMode === "binding" ? "include" : "omit",
    headers,
    method: upload.method,
  })

  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}.`)
  }
}

function getUploadUrl(upload: ImageUploadTarget) {
  if (upload.storageMode === "s3") {
    return upload.url
  }

  try {
    const url = new URL(upload.url)

    return toApiUrl(`${url.pathname}${url.search}`)
  } catch {
    return toApiUrl(upload.url)
  }
}
