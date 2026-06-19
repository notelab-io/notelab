import type { CSSProperties } from "react";

export const connectorUiStyles: Record<string, CSSProperties> = {
  collapseInner: {
    minHeight: 0,
    overflow: "hidden",
  },
  collapseRegion: {
    display: "grid",
    overflow: "hidden",
    transition:
      "grid-template-rows 180ms ease, opacity 160ms ease, margin-top 180ms ease",
  },
  headerActions: {
    alignItems: "center",
    display: "flex",
    flex: "0 0 auto",
    gap: 6,
  },
  kicker: {
    color: "color-mix(in srgb, currentColor 58%, transparent)",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.2,
    textTransform: "uppercase",
  },
  panel: {
    display: "grid",
    gap: 10,
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
  searchHeader: {
    alignItems: "center",
    display: "flex",
    gap: 12,
    justifyContent: "space-between",
    marginBottom: 2,
  },
  searchSummary: {
    color: "color-mix(in srgb, currentColor 60%, transparent)",
    fontSize: 11,
    lineHeight: 1.35,
    marginTop: 2,
  },
  sourceIcon: {
    flex: "0 0 auto",
    height: 16,
    width: 16,
  },
  sourceTitle: {
    alignItems: "center",
    display: "flex",
    gap: 8,
    minWidth: 0,
  },
  stat: {
    background: "color-mix(in srgb, currentColor 6%, transparent)",
    borderRadius: 6,
    display: "grid",
    gap: 3,
    padding: "10px 12px",
  },
  title: {
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.3,
    marginTop: 3,
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
};

export function collapseRegionStyle(isExpanded: boolean) {
  return {
    ...connectorUiStyles.collapseRegion,
    gridTemplateRows: isExpanded ? "1fr" : "0fr",
    marginTop: isExpanded ? 0 : -6,
    opacity: isExpanded ? 1 : 0,
  };
}