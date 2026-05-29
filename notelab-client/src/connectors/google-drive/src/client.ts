import { GOOGLE_DRIVE_API_BASE_URL } from "./constants.js";
import { GoogleDriveConnectorError } from "./errors.js";
import { resolveFetch, type GoogleDriveFetch } from "./fetch.js";
import type {
  GoogleDriveAbout,
  GoogleDriveFile,
  GoogleDriveFilesResponse,
} from "./types.js";

export type GoogleDriveClientOptions = {
  accessToken: string;
  baseUrl?: string;
  fetch?: GoogleDriveFetch;
};

export type ListGoogleDriveFilesOptions = {
  corpora?: "user" | "drive" | "allDrives";
  driveId?: string;
  fields?: string;
  includeItemsFromAllDrives?: boolean;
  maxResults?: number;
  orderBy?: string;
  pageToken?: string;
  query?: string;
  spaces?: string;
  supportsAllDrives?: boolean;
};

export class GoogleDriveReadonlyClient {
  readonly #accessToken: string;
  readonly #baseUrl: string;
  readonly #fetch: GoogleDriveFetch;

  constructor({
    accessToken,
    baseUrl = GOOGLE_DRIVE_API_BASE_URL,
    fetch: fetchImpl,
  }: GoogleDriveClientOptions) {
    this.#accessToken = accessToken;
    this.#baseUrl = baseUrl.replace(/\/$/, "");
    this.#fetch = resolveFetch(fetchImpl);
  }

  listFiles(options: ListGoogleDriveFilesOptions = {}) {
    const search = new URLSearchParams();
    search.set(
      "fields",
      options.fields ??
        "nextPageToken,incompleteSearch,files(id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,createdTime,modifiedTime,owners(displayName,emailAddress,me),parents,size,shared,trashed,exportLinks)",
    );

    if (options.corpora) {
      search.set("corpora", options.corpora);
    }

    if (options.driveId) {
      search.set("driveId", options.driveId);
    }

    if (options.includeItemsFromAllDrives !== undefined) {
      search.set(
        "includeItemsFromAllDrives",
        String(options.includeItemsFromAllDrives),
      );
    }

    if (options.maxResults) {
      search.set("pageSize", String(options.maxResults));
    }

    if (options.orderBy) {
      search.set("orderBy", options.orderBy);
    }

    if (options.pageToken) {
      search.set("pageToken", options.pageToken);
    }

    if (options.query) {
      search.set("q", options.query);
    }

    if (options.spaces) {
      search.set("spaces", options.spaces);
    }

    if (options.supportsAllDrives !== undefined) {
      search.set("supportsAllDrives", String(options.supportsAllDrives));
    }

    return this.#request<GoogleDriveFilesResponse>(
      `files${toQueryString(search)}`,
    );
  }

  getFile(fileId: string, fields?: string) {
    const search = new URLSearchParams();
    search.set(
      "fields",
      fields ??
        "id,name,mimeType,webViewLink,webContentLink,iconLink,thumbnailLink,createdTime,modifiedTime,owners(displayName,emailAddress,me),parents,size,shared,trashed,exportLinks,description",
    );
    search.set("supportsAllDrives", "true");

    return this.#request<GoogleDriveFile>(
      `files/${encodeURIComponent(fileId)}${toQueryString(search)}`,
    );
  }

  async getFileContent(fileId: string) {
    const response = await this.#fetch(
      `${this.#baseUrl}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          authorization: `Bearer ${this.#accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new GoogleDriveConnectorError(
        "Google Drive API request failed.",
        {
          code: "GOOGLE_DRIVE_API_REQUEST_FAILED",
          status: response.status,
        },
      );
    }

    return response.text();
  }

  async exportFile(fileId: string, mimeType: string) {
    const search = new URLSearchParams({ mimeType });
    const response = await this.#fetch(
      `${this.#baseUrl}/files/${encodeURIComponent(
        fileId,
      )}/export${toQueryString(search)}`,
      {
        headers: {
          authorization: `Bearer ${this.#accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new GoogleDriveConnectorError(
        "Google Drive export request failed.",
        {
          code: "GOOGLE_DRIVE_EXPORT_REQUEST_FAILED",
          status: response.status,
        },
      );
    }

    return response.text();
  }

  getAbout() {
    return this.#request<GoogleDriveAbout>(
      "about?fields=user(displayName,emailAddress,me),storageQuota",
    );
  }

  async #request<T>(path: string): Promise<T> {
    const response = await this.#fetch(`${this.#baseUrl}/${path}`, {
      headers: {
        authorization: `Bearer ${this.#accessToken}`,
      },
    });

    if (!response.ok) {
      throw new GoogleDriveConnectorError("Google Drive API request failed.", {
        code: "GOOGLE_DRIVE_API_REQUEST_FAILED",
        status: response.status,
      });
    }

    return response.json() as Promise<T>;
  }
}

function toQueryString(search: URLSearchParams) {
  const value = search.toString();
  return value ? `?${value}` : "";
}
