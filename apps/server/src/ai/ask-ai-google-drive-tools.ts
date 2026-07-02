import {
  GoogleDriveReadonlyClient,
  summarizeGoogleDriveFile,
  type GoogleDriveFile,
} from "@notelab/connectors/google-drive";
import { tool, type ToolSet } from "ai";
import * as z from "zod";

import { truncateText } from "./ask-ai-utils";

const googlePageExportMimeTypes: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};

export function buildGoogleDriveTools(accessToken: string): ToolSet {
  const drive = new GoogleDriveReadonlyClient({
    accessToken,
    fetch: (input, init) => fetch(input, init),
  });

  return {
    getGoogleDriveProfile: tool({
      description:
        "Read the connected Google Drive profile and storage quota metadata.",
      inputSchema: z.object({}),
      execute: async () => drive.getAbout(),
    }),
    listGoogleDriveFiles: tool({
      description:
        "List recent Google Drive files visible to the connected user. Returns file metadata only.",
      inputSchema: z.object({
        includeSharedDrives: z.boolean().default(true),
        maxResults: z.number().int().min(1).max(20).default(10),
        pageToken: z.string().trim().optional(),
      }),
      execute: async ({ includeSharedDrives, maxResults, pageToken }) => {
        const response = await drive.listFiles({
          corpora: includeSharedDrives ? "allDrives" : "user",
          includeItemsFromAllDrives: includeSharedDrives,
          maxResults,
          orderBy: "modifiedTime desc",
          pageToken,
          query: "trashed = false",
          spaces: "drive",
          supportsAllDrives: includeSharedDrives,
        });

        return {
          files: (response.files ?? []).map(summarizeGoogleDriveFile),
          incompleteSearch: response.incompleteSearch,
          nextPageToken: response.nextPageToken,
        };
      },
    }),
    searchGoogleDriveFiles: tool({
      description:
        "Search Google Drive files by name or full text and return matching file metadata.",
      inputSchema: z.object({
        includeSharedDrives: z.boolean().default(true),
        maxResults: z.number().int().min(1).max(20).default(10),
        pageToken: z.string().trim().optional(),
        query: z
          .string()
          .trim()
          .min(1)
          .describe(
            "A plain search phrase. The tool searches Drive file names and indexed full text.",
          ),
      }),
      execute: async ({ includeSharedDrives, maxResults, pageToken, query }) => {
        const response = await drive.listFiles({
          corpora: includeSharedDrives ? "allDrives" : "user",
          includeItemsFromAllDrives: includeSharedDrives,
          maxResults,
          orderBy: "modifiedTime desc",
          pageToken,
          query: buildDriveSearchQuery(query),
          spaces: "drive",
          supportsAllDrives: includeSharedDrives,
        });

        return {
          files: (response.files ?? []).map(summarizeGoogleDriveFile),
          incompleteSearch: response.incompleteSearch,
          nextPageToken: response.nextPageToken,
        };
      },
    }),
    getGoogleDriveFile: tool({
      description:
        "Read Google Drive file metadata by file id. Use after listing or searching when a file needs closer inspection.",
      inputSchema: z.object({
        fileId: z.string().trim().min(1),
      }),
      execute: async ({ fileId }) => drive.getFile(fileId),
    }),
    getGoogleDriveFileText: tool({
      description:
        "Read text content from a Google Drive file id. Supports Google Docs/Sheets/Slides export and text-like binary files.",
      inputSchema: z.object({
        fileId: z.string().trim().min(1),
        maxTextLength: z.number().int().min(0).max(50000).default(12000),
        mimeType: z
          .string()
          .trim()
          .optional()
          .describe("Optional MIME type from list/search results."),
      }),
      execute: async ({ fileId, maxTextLength, mimeType }) => {
        const file = await drive.getFile(fileId);
        const effectiveMimeType = mimeType || file.mimeType;
        const text = await readDriveText(drive, file, effectiveMimeType);
        const truncatedText = truncateText(text, maxTextLength);

        return {
          file: summarizeGoogleDriveFile(file),
          isTextTruncated:
            Boolean(text) &&
            Boolean(truncatedText) &&
            (truncatedText?.length ?? 0) < text.length,
          text: truncatedText,
        };
      },
    }),
  };
}

async function readDriveText(
  drive: GoogleDriveReadonlyClient,
  file: GoogleDriveFile,
  mimeType?: string,
) {
  if (mimeType && googlePageExportMimeTypes[mimeType]) {
    return drive.exportFile(file.id, googlePageExportMimeTypes[mimeType]);
  }

  if (!mimeType || isTextLikeMimeType(mimeType)) {
    return drive.getFileContent(file.id);
  }

  return `File content is not text-readable by this connector. MIME type: ${mimeType}`;
}

function buildDriveSearchQuery(query: string) {
  const escaped = query.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  return `trashed = false and (name contains '${escaped}' or fullText contains '${escaped}')`;
}

function isTextLikeMimeType(mimeType: string) {
  return (
    mimeType.startsWith("text/") ||
    mimeType === "application/json" ||
    mimeType.endsWith("+json") ||
    mimeType === "application/xml" ||
    mimeType.endsWith("+xml") ||
    mimeType === "text/csv"
  );
}
