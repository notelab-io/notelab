import type { CSSProperties } from "react";

import {
  CollapsibleConnectorPanel,
} from "../../../shared/connector-ui.js";
import { formatConnectorShortDate } from "../../../shared/format.js";

import type {
  GoogleDriveAbout,
  GoogleDriveFile,
  GoogleDriveFileSummary,
} from "./types.js";

const driveIconSrc = "/icons/google-drive.svg";
const separatorBorder =
  "1px solid color-mix(in srgb, currentColor 10%, transparent)";

const styles: Record<string, CSSProperties> = {
  rowList: {
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 8,
    display: "grid",
    overflow: "hidden",
  },
  row: {
    borderTop: separatorBorder,
    display: "grid",
    gap: 6,
    padding: "10px 12px",
  },
  meta: {
    color: "color-mix(in srgb, currentColor 66%, transparent)",
    display: "flex",
    flexWrap: "wrap",
    fontSize: 12,
    gap: "6px 10px",
    lineHeight: 1.35,
  },
  snippet: {
    color: "color-mix(in srgb, currentColor 78%, transparent)",
    fontSize: 13,
    lineHeight: 1.45,
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  empty: {
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 8,
    color: "color-mix(in srgb, currentColor 66%, transparent)",
    fontSize: 13,
    padding: 12,
  },
};

export type GoogleDriveToolName =
  | "getGoogleDriveFile"
  | "getGoogleDriveFileText"
  | "getGoogleDriveProfile"
  | "listGoogleDriveFiles"
  | "searchGoogleDriveFiles";

export type ListGoogleDriveFilesOutput = {
  files?: GoogleDriveFileSummary[];
  incompleteSearch?: boolean;
  nextPageToken?: string;
};

export type GoogleDriveFileTextOutput = {
  file: GoogleDriveFileSummary;
  isTextTruncated: boolean;
  text?: string;
};

export type GoogleDriveToolOutput =
  | GoogleDriveAbout
  | GoogleDriveFile
  | GoogleDriveFileTextOutput
  | ListGoogleDriveFilesOutput;

export type GoogleDriveToolOutputProps = {
  className?: string;
  output: GoogleDriveToolOutput;
  toolName: GoogleDriveToolName;
};

export function GoogleDriveToolOutput({
  className,
  output,
  toolName,
}: GoogleDriveToolOutputProps) {
  if (toolName === "getGoogleDriveProfile") {
    const profile = output as GoogleDriveAbout;

    return (
      <CollapsibleConnectorPanel
        className={className}
        countLabel="Profile"
        expandedLabels={{
          hide: "Hide Google Drive results",
          show: "Show Google Drive results",
        }}
        iconSrc={driveIconSrc}
        summary={profile.user?.emailAddress || "Google Drive profile"}
        title="Drive profile"
      >
        <div style={styles.rowList}>
          <DriveRow isFirst>
            <strong>{profile.user?.displayName || "Connected user"}</strong>
            <div style={styles.meta}>{profile.user?.emailAddress}</div>
          </DriveRow>
        </div>
      </CollapsibleConnectorPanel>
    );
  }

  if (toolName === "getGoogleDriveFileText") {
    const textOutput = output as GoogleDriveFileTextOutput;

    return (
      <CollapsibleConnectorPanel
        className={className}
        countLabel={textOutput.isTextTruncated ? "Truncated" : "Text"}
        expandedLabels={{
          hide: "Hide Google Drive results",
          show: "Show Google Drive results",
        }}
        iconSrc={driveIconSrc}
        summary={textOutput.file.name || textOutput.file.id}
        title="Drive file text"
      >
        <div style={styles.rowList}>
          <DriveRow isFirst>
            <strong>{textOutput.file.name || textOutput.file.id}</strong>
            <div style={styles.meta}>{textOutput.file.mimeType}</div>
            {textOutput.text ? (
              <p style={styles.snippet}>{textOutput.text}</p>
            ) : null}
          </DriveRow>
        </div>
      </CollapsibleConnectorPanel>
    );
  }

  if (toolName === "getGoogleDriveFile") {
    const file = output as GoogleDriveFile;

    return (
      <CollapsibleConnectorPanel
        className={className}
        countLabel="File"
        expandedLabels={{
          hide: "Hide Google Drive results",
          show: "Show Google Drive results",
        }}
        iconSrc={driveIconSrc}
        summary={file.name || file.id}
        title="Drive file"
      >
        <FileList files={[file]} />
      </CollapsibleConnectorPanel>
    );
  }

  const listOutput = output as ListGoogleDriveFilesOutput;

  return (
    <CollapsibleConnectorPanel
      className={className}
      countLabel={`${listOutput.files?.length ?? 0} shown`}
      expandedLabels={{
        hide: "Hide Google Drive results",
        show: "Show Google Drive results",
      }}
      iconSrc={driveIconSrc}
      summary={
        listOutput.files?.length
          ? `${listOutput.files.length} files shown from Google Drive`
          : "No files returned from Google Drive"
      }
      title={toolName === "searchGoogleDriveFiles" ? "Drive search" : "Drive files"}
    >
      {listOutput.files?.length ? (
        <FileList files={listOutput.files} />
      ) : (
        <Empty>No files returned.</Empty>
      )}
      {listOutput.nextPageToken ? (
        <div style={{ ...styles.meta, paddingTop: 2 }}>
          More results are available in Google Drive.
        </div>
      ) : null}
    </CollapsibleConnectorPanel>
  );
}

export function isGoogleDriveToolName(
  toolName: string,
): toolName is GoogleDriveToolName {
  return (
    toolName === "getGoogleDriveFile" ||
    toolName === "getGoogleDriveFileText" ||
    toolName === "getGoogleDriveProfile" ||
    toolName === "listGoogleDriveFiles" ||
    toolName === "searchGoogleDriveFiles"
  );
}

function FileList({ files }: { files: Array<GoogleDriveFile | GoogleDriveFileSummary> }) {
  return (
    <div style={styles.rowList}>
      {files.map((file, index) => (
        <DriveRow isFirst={index === 0} key={file.id}>
          <strong>{file.name || file.id}</strong>
          <div style={styles.meta}>
            {file.mimeType}
            {file.modifiedTime
              ? `Modified ${formatConnectorShortDate(file.modifiedTime)}`
              : null}
            {file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress}
          </div>
        </DriveRow>
      ))}
    </div>
  );
}

function DriveRow({
  children,
  isFirst,
}: {
  children: React.ReactNode;
  isFirst: boolean;
}) {
  return (
    <article style={{ ...styles.row, borderTop: isFirst ? 0 : separatorBorder }}>
      {children}
    </article>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={styles.empty}>{children}</div>;
}
