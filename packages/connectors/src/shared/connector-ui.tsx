"use client";

import { useState, type CSSProperties, type ReactNode } from "react";

import {
  collapseRegionStyle,
  connectorUiStyles,
} from "./connector-ui-styles.js";

export function ChevronIcon({ expanded }: { expanded: boolean }) {
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

export function SourceTitle({
  iconSrc,
  title,
}: {
  iconSrc: string;
  title: ReactNode;
}) {
  return (
    <div style={connectorUiStyles.sourceTitle}>
      <img
        alt=""
        aria-hidden="true"
        src={iconSrc}
        style={connectorUiStyles.sourceIcon}
      />
      <div style={{ ...connectorUiStyles.title, marginTop: 0 }}>{title}</div>
    </div>
  );
}

export function ConnectorTitle({
  kicker,
  title,
}: {
  kicker: ReactNode;
  title: ReactNode;
}) {
  return (
    <div>
      <div style={connectorUiStyles.kicker}>{kicker}</div>
      <div style={connectorUiStyles.title}>{title}</div>
    </div>
  );
}

export function ConnectorStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={connectorUiStyles.stat}>
      <span style={connectorUiStyles.kicker}>{label}</span>
      <span style={connectorUiStyles.title}>{value}</span>
    </div>
  );
}

export function metadataItem(label: string, value?: string) {
  return value ? (
    <span>
      {label}: {value}
    </span>
  ) : null;
}

export function CollapsibleConnectorPanel({
  children,
  className,
  countLabel,
  expandedLabels,
  iconSrc,
  sectionStyle,
  summary,
  title,
}: {
  children: ReactNode;
  className?: string;
  countLabel: string;
  expandedLabels: { hide: string; show: string };
  iconSrc: string;
  sectionStyle?: CSSProperties;
  summary: string;
  title: string;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section
      className={className}
      style={{ ...connectorUiStyles.panel, ...sectionStyle }}
    >
      <div style={connectorUiStyles.searchHeader}>
        <div>
          <SourceTitle iconSrc={iconSrc} title={title} />
          <div style={connectorUiStyles.searchSummary}>{summary}</div>
        </div>
        <div style={connectorUiStyles.headerActions}>
          <span style={connectorUiStyles.pill}>{countLabel}</span>
          <button
            aria-expanded={isExpanded}
            aria-label={isExpanded ? expandedLabels.hide : expandedLabels.show}
            onClick={() => setIsExpanded((current) => !current)}
            style={connectorUiStyles.toggleButton}
            type="button"
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        </div>
      </div>
      <div style={collapseRegionStyle(isExpanded)}>
        <div style={connectorUiStyles.collapseInner}>{children}</div>
      </div>
    </section>
  );
}