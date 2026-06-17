import { API_BASE_URL } from '@/lib/api-base-url';
import { apiFetch, getApiRequestHeaders } from '@/lib/api';

type ImageAsset = {
  byteSize: number;
  contentType: string;
  filename: string;
  id: string;
  status: string;
};

type ImageUploadTarget = {
  expiresAt: string;
  headers: Record<string, string>;
  method: 'PUT';
  storageMode: 's3' | 'binding';
  url: string;
};

type CreateImageUploadResponse = {
  asset: ImageAsset;
  upload: ImageUploadTarget;
};

type CompleteImageUploadResponse = {
  asset: ImageAsset;
};

type ReactNativeFileBody = {
  name: string;
  type: string;
  uri: string;
};

export type UploadWorkspaceImageInput = {
  body: Blob | File | ReactNativeFileBody;
  byteSize: number;
  contentType: string;
  databaseId?: string | null;
  filename: string;
  organizationId: string;
  workspaceId: string;
};

export type UploadedWorkspaceImage = {
  asset: ImageAsset;
  url: string;
};

export async function uploadWorkspaceImage({
  body,
  byteSize,
  contentType,
  databaseId,
  filename,
  organizationId,
  workspaceId,
}: UploadWorkspaceImageInput): Promise<UploadedWorkspaceImage> {
  if (!contentType.startsWith('image/')) {
    throw new Error('Only image uploads are supported.');
  }

  const { asset, upload } = await apiFetch<CreateImageUploadResponse>('/images/uploads', {
    body: JSON.stringify({
      byteSize,
      contentType,
      databaseId: databaseId || undefined,
      filename,
      organizationId,
      workspaceId,
    }),
    method: 'POST',
  });

  await putImageBody(upload, body);

  const completed = await apiFetch<CompleteImageUploadResponse>(
    `/images/uploads/${encodeURIComponent(asset.id)}/complete`,
    { method: 'POST' }
  );

  return {
    asset: completed.asset,
    url: `${API_BASE_URL}/images/${encodeURIComponent(completed.asset.id)}`,
  };
}

async function putImageBody(upload: ImageUploadTarget, body: UploadWorkspaceImageInput['body']) {
  const headers =
    upload.storageMode === 'binding'
      ? getApiRequestHeaders(upload.headers)
      : new Headers(upload.headers);
  const response = await fetch(getUploadUrl(upload), {
    body: body as BodyInit,
    credentials: upload.storageMode === 'binding' ? 'omit' : 'same-origin',
    headers,
    method: upload.method,
  });

  if (!response.ok) {
    throw new Error(`Image upload failed with status ${response.status}.`);
  }
}

function getUploadUrl(upload: ImageUploadTarget) {
  if (upload.storageMode === 's3') {
    return upload.url;
  }

  try {
    const url = new URL(upload.url);

    return `${API_BASE_URL}${url.pathname}${url.search}`;
  } catch {
    return upload.url.startsWith('/')
      ? `${API_BASE_URL}${upload.url}`
      : `${API_BASE_URL}/${upload.url}`;
  }
}
