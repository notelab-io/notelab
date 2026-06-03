import type { GoogleDriveFile, GoogleDriveFileSummary } from "./types.js";

export function summarizeGoogleDriveFile(
  file: GoogleDriveFile,
): GoogleDriveFileSummary {
  return {
    createdTime: file.createdTime,
    id: file.id,
    mimeType: file.mimeType,
    modifiedTime: file.modifiedTime,
    name: file.name,
    owners: file.owners,
    size: file.size,
    webViewLink: file.webViewLink,
  };
}
