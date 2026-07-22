import { getToolkitToolMetadata } from "@zilobase/toolkit/vercel/metadata";

import { integrationIcons } from "@/lib/integration-icons";

export type IntegrationToolSource = keyof typeof integrationIcons;

export type IntegrationToolPresentation = {
  progressPhrases: string[];
  source?: IntegrationToolSource;
  title: string;
  toolId?: string;
};

export function resolveIntegrationToolPresentation(input: {
  part: { title?: string; toolMetadata?: unknown };
  source?: IntegrationToolSource;
  title?: string;
  toolName: string;
}): IntegrationToolPresentation {
  const metadata = getToolkitToolMetadata(input.part.toolMetadata);

  if (metadata) {
    return {
      progressPhrases: [...metadata.presentation.progressPhrases],
      source: getIntegrationSource(metadata.connectorId),
      title: metadata.presentation.title,
      toolId: metadata.toolId,
    };
  }

  const title =
    input.part.title?.trim() ||
    input.title?.trim() ||
    humanizeToolName(input.toolName);

  return {
    progressPhrases: [`Running ${title}`],
    source: input.source,
    title,
  };
}

function getIntegrationSource(
  connectorId: string,
): IntegrationToolSource | undefined {
  return connectorId in integrationIcons
    ? (connectorId as IntegrationToolSource)
    : undefined;
}

function humanizeToolName(toolName: string) {
  const value = toolName
    .replace(/[._-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim();

  return value
    ? `${value.charAt(0).toUpperCase()}${value.slice(1)}`
    : "Tool call";
}
