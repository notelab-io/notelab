import { useState, type CSSProperties, type ReactNode } from "react";

import type {
  GoogleDriveAbout,
  GoogleDriveFile,
  GoogleDriveFileSummary,
} from "./types.js";

const driveIconSrc = "/icons/google-drive.svg";
const separatorBorder =
  "1px solid color-mix(in srgb, currentColor 10%, transparent)";

const styles: Record<string, CSSProperties> = {
  panel: {
    display: "grid",
    gap: 10,
  },
  searchHeader: {
    alignItems: "center",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  sourceTitle: {
    alignItems: "center",
    display: "flex",
    gap: 8,
    minWidth: 0,
  },
  sourceIcon: {
    flex: "0 0 auto",
    height: 16,
    width: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.3,
    marginTop: 3,
  },
  searchSummary: {
    color: "color-mix(in srgb, currentColor 60%, transparent)",
    fontSize: 11,
    lineHeight: 1.35,
    marginTop: 2,
  },
  headerActions: {
    alignItems: "center",
    display: "flex",
    flex: "0 0 auto",
    gap: 6,
  },
  pill: {
    border: "1px solid color-mix(in srgb, currentColor 15%, transparent)",
    borderRadius: 999,
    color: "color-mix(in srgb, currentColor 68%, transparent)",
    fontSize: 11,
    lineHeight: 1,
    padding: "4px 7px",
    whiteSpace: "nowrap",
  },
  toggleButton: {
    alignItems: "center",
    background: "transparent",
    border: "1px solid color-mix(in srgb, currentColor 16%, transparent)",
    borderRadius: 999,
    color: "color-mix(in srgb, currentColor 70%, transparent)",
    cursor: "pointer",
    display: "inline-flex",
    font: "inherit",
    fontSize: 12,
    height: 24,
    justifyContent: "center",
    lineHeight: 1,
    padding: 0,
    width: 24,
  },
  collapseRegion: {
    display: "grid",
    overflow: "hidden",
    transition:
      "grid-template-rows 180ms ease, opacity 160ms ease, margin-top 180ms ease",
  },
  collapseInner: {
    minHeight: 0,
    overflow: "hidden",
  },
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
      <DrivePanel
        className={className}
        countLabel="Profile"
        summary={profile.user?.emailAddress || "Google Drive profile"}
        title="Drive profile"
      >
        <div style={styles.rowList}>
          <DriveRow isFirst>
            <strong>{profile.user?.displayName || "Connected user"}</strong>
            <div style={styles.meta}>{profile.user?.emailAddress}</div>
          </DriveRow>
        </div>
      </DrivePanel>
    );
  }

  if (toolName === "getGoogleDriveFileText") {
    const textOutput = output as GoogleDriveFileTextOutput;

    return (
      <DrivePanel
        className={className}
        countLabel={textOutput.isTextTruncated ? "Truncated" : "Text"}
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
      </DrivePanel>
    );
  }

  if (toolName === "getGoogleDriveFile") {
    const file = output as GoogleDriveFile;

    return (
      <DrivePanel
        className={className}
        countLabel="File"
        summary={file.name || file.id}
        title="Drive file"
      >
        <FileList files={[file]} />
      </DrivePanel>
    );
  }

  const listOutput = output as ListGoogleDriveFilesOutput;

  return (
    <DrivePanel
      className={className}
      countLabel={`${listOutput.files?.length ?? 0} shown`}
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
    </DrivePanel>
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
            {file.modifiedTime ? `Modified ${formatDate(file.modifiedTime)}` : null}
            {file.owners?.[0]?.displayName || file.owners?.[0]?.emailAddress}
          </div>
        </DriveRow>
      ))}
    </div>
  );
}

function DrivePanel({
  children,
  className,
  countLabel,
  summary,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  countLabel: string;
  summary: string;
  title: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className={className} style={styles.panel}>
      <div style={styles.searchHeader}>
        <div>
          <SourceTitle iconSrc={driveIconSrc} title={title} />
          <div style={styles.searchSummary}>{summary}</div>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.pill}>{countLabel}</span>
          <button
            aria-expanded={isExpanded}
            aria-label={
              isExpanded
                ? "Hide Google Drive results"
                : "Show Google Drive results"
            }
            onClick={() => setIsExpanded((current) => !current)}
            style={styles.toggleButton}
            type="button"
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        </div>
      </div>
      <div
        style={{
          ...styles.collapseRegion,
          gridTemplateRows: isExpanded ? "1fr" : "0fr",
          marginTop: isExpanded ? 0 : -6,
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div style={styles.collapseInner}>{children}</div>
      </div>
    </section>
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

function SourceTitle({ iconSrc, title }: { iconSrc: string; title: ReactNode }) {
  return (
    <div style={styles.sourceTitle}>
      <img alt="" aria-hidden="true" src={iconSrc} style={styles.sourceIcon} />
      <div style={{ ...styles.title, marginTop: 0 }}>{title}</div>
    </div>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="14"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={{
        transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
        transition: "transform 140ms ease",
      }}
      viewBox="0 0 24 24"
      width="14"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}
