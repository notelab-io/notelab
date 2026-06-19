"use client";

import { useState, type CSSProperties } from "react";

import { ChevronIcon, SourceTitle } from "../../../shared/connector-ui.js";
import {
  collapseRegionStyle,
  connectorUiStyles,
} from "../../../shared/connector-ui-styles.js";

const slackIconSrc = "/icons/slack.svg";

export type SlackToolName =
  | "getSlackConversationHistory"
  | "getSlackFileInfo"
  | "getSlackProfile"
  | "getSlackThread"
  | "getSlackUser"
  | "listSlackCanvases"
  | "listSlackConversations"
  | "listSlackFiles"
  | "lookupSlackCanvasSections"
  | "searchSlackMessages";

export type SlackToolOutputProps = {
  channels?: string[];
  className?: string;
  errorText?: string;
  input?: unknown;
  output?: unknown;
  toolName: SlackToolName;
};

const styles: Record<string, CSSProperties> = {
  card: {
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 8,
    boxSizing: "border-box",
    color: "inherit",
    display: "grid",
    gap: 12,
    maxWidth: "100%",
    padding: 16,
    width: "100%",
  },
  header: {
    alignItems: "center",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
  },
  main: {
    display: "grid",
    flex: "1 1 auto",
    gap: 5,
    minWidth: 0,
  },
  kicker: {
    color: "color-mix(in srgb, currentColor 58%, transparent)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  headerActions: connectorUiStyles.headerActions,
  pill: connectorUiStyles.pill,
  toggleButton: connectorUiStyles.toggleButton,
  collapseInner: {
    ...connectorUiStyles.collapseInner,
    display: "grid",
    gap: 12,
  },
  guide: {
    alignItems: "center",
    borderTop: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
    display: "flex",
    flexWrap: "wrap",
    gap: "10px 12px",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  body: {
    color: "color-mix(in srgb, currentColor 64%, transparent)",
    fontSize: 12,
    lineHeight: 1.45,
    margin: 0,
  },
  inlineCommand: {
    background: "color-mix(in srgb, currentColor 7%, transparent)",
    border: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
    borderRadius: 5,
    color: "color-mix(in srgb, currentColor 78%, transparent)",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 11,
    lineHeight: 1,
    padding: "2px 5px",
    whiteSpace: "nowrap",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "flex-end",
  },
  button: {
    alignItems: "center",
    border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
    borderRadius: 7,
    color: "color-mix(in srgb, currentColor 86%, transparent)",
    display: "inline-flex",
    fontSize: 12,
    fontWeight: 600,
    gap: 6,
    justifyContent: "center",
    lineHeight: 1,
    minHeight: 32,
    padding: "8px 10px",
    textDecoration: "none",
  },
  primaryButton: {
    background: "#611f69",
    borderColor: "#611f69",
    color: "#ffffff",
  },
  meta: {
    color: "color-mix(in srgb, currentColor 52%, transparent)",
    fontSize: 11,
    lineHeight: 1.35,
    margin: 0,
  },
  collapsedMeta: {
    color: "color-mix(in srgb, currentColor 58%, transparent)",
    fontSize: 11,
    lineHeight: 1.35,
    marginTop: 2,
  },
};

const slackInviteDocsUrl =
  "https://slack.com/help/articles/201980108-Add-people-to-a-channel";

export function SlackToolOutput({
  channels,
  className,
  errorText,
  input,
  toolName,
}: SlackToolOutputProps) {
  if (!errorText?.includes("not_in_channel")) {
    return null;
  }

  const channelIds = channels?.length
    ? Array.from(new Set(channels.map((channel) => channel.trim()).filter(Boolean)))
    : getChannelId(input)
      ? [getChannelId(input) as string]
      : [];
  const firstChannel = channelIds[0];
  const channelUrl = firstChannel
    ? `https://slack.com/app_redirect?channel=${encodeURIComponent(firstChannel)}`
    : "https://slack.com/app_redirect";
  const channelCount = channelIds.length;
  const [isExpanded, setIsExpanded] = useState(true);
  const countLabel = channelCount
    ? `${channelCount} ${channelCount === 1 ? "channel" : "channels"}`
    : "Slack";

  return (
    <section className={className} style={styles.card}>
      <div style={styles.header}>
        <div>
          <SourceTitle iconSrc={slackIconSrc} title="Slack access needed" />
          <div style={styles.collapsedMeta}>
            {channelCount > 1
              ? `Invite Notelab to ${channelCount} channels`
              : "Invite Notelab to this channel"}
          </div>
        </div>
        <div style={styles.headerActions}>
          <span style={styles.pill}>{countLabel}</span>
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Hide Slack details" : "Show Slack details"}
            onClick={() => setIsExpanded((current) => !current)}
            style={styles.toggleButton}
            type="button"
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        </div>
      </div>
      <div style={collapseRegionStyle(isExpanded)}>
        <div style={styles.collapseInner}>
          <div style={styles.main}>
            <p style={styles.body}>
              Slack blocked this read because the Notelab app is not a member of
              {channelCount > 1 ? " these channels" : " the channel"}. Open Slack, run{" "}
              <code style={styles.inlineCommand}>/invite @notelab</code>, then retry
              the request in Notelab.
            </p>
          </div>
          <div style={styles.guide}>
            {channelIds.length ? (
              <p style={styles.meta}>
                Channel {channelIds.length === 1 ? "id" : "ids"}:{" "}
                {channelIds.join(", ")}
              </p>
            ) : (
              <p style={styles.meta}>
                No channel id was attached to this {toolName} call.
              </p>
            )}
            <div style={styles.actions}>
              <a
                href={slackInviteDocsUrl}
                rel="noopener noreferrer"
                style={styles.button}
                target="_blank"
              >
                Invite docs
              </a>
              <a
                href={channelUrl}
                rel="noopener noreferrer"
                style={{ ...styles.button, ...styles.primaryButton }}
                target="_blank"
              >
                {channelCount > 1 ? "Open first channel" : "Open Slack channel"}
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function isSlackToolName(toolName: string): toolName is SlackToolName {
  return (
    toolName === "getSlackConversationHistory" ||
    toolName === "getSlackFileInfo" ||
    toolName === "getSlackProfile" ||
    toolName === "getSlackThread" ||
    toolName === "getSlackUser" ||
    toolName === "listSlackCanvases" ||
    toolName === "listSlackConversations" ||
    toolName === "listSlackFiles" ||
    toolName === "lookupSlackCanvasSections" ||
    toolName === "searchSlackMessages"
  );
}

function getChannelId(input: unknown) {
  if (!input || typeof input !== "object" || !("channel" in input)) {
    return undefined;
  }

  const channel = input.channel;
  return typeof channel === "string" && channel.trim()
    ? channel.trim()
    : undefined;
}
