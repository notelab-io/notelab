import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { workspaceAiProviderConfig } from "../../db/schema";

export type AiProviderCatalogItem = {
  id: string;
  name: string;
  kind: "openai";
  baseUrl?: string;
  models: Array<{ id: string; name: string }>;
  requiresApiKey: boolean;
};

export const providerCatalog: AiProviderCatalogItem[] = [
  openAiCompatible("openai", "OpenAI", "https://api.openai.com/v1", [
    ["gpt-4o-mini", "GPT-4o Mini"],
    ["gpt-4o", "GPT-4o"],
  ]),
];

export async function listAiProviderConfigs(workspaceId: string) {
  const rows = await db
    .select()
    .from(workspaceAiProviderConfig)
    .where(eq(workspaceAiProviderConfig.workspaceId, workspaceId));
  const byProvider = new Map(rows.map((row) => [row.providerId, row]));

  return providerCatalog.map((provider) => {
    const row = byProvider.get(provider.id);

    return {
      apiKeyConfigured: Boolean(row?.apiKey),
      baseUrl: row?.baseUrl ?? provider.baseUrl ?? "",
      enabled: row?.enabled ?? true,
      modelIds: Array.isArray(row?.modelIds)
        ? row.modelIds
        : provider.models.map((model) => model.id),
      provider,
      providerId: provider.id,
      updatedAt: row?.updatedAt?.toISOString(),
    };
  });
}

export async function getAiProviderConfig(
  workspaceId: string,
  providerId: string,
) {
  const [row] = await db
    .select()
    .from(workspaceAiProviderConfig)
    .where(
      and(
        eq(workspaceAiProviderConfig.workspaceId, workspaceId),
        eq(workspaceAiProviderConfig.providerId, providerId),
      ),
    )
    .limit(1);

  return row ?? null;
}

export function getCatalogItem(providerId: string) {
  const provider = providerCatalog.find((item) => item.id === providerId);

  if (!provider) {
    throw new Error(`Unknown AI provider: ${providerId}`);
  }

  return provider;
}

function openAiCompatible(
  id: string,
  name: string,
  baseUrl: string | undefined,
  models: Array<[string, string]>,
): AiProviderCatalogItem {
  return {
    id,
    name,
    kind: "openai",
    baseUrl,
    requiresApiKey: true,
    models: models.map(([modelId, modelName]) => ({ id: modelId, name: modelName })),
  };
}
