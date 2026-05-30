import { and, eq } from "drizzle-orm";

import { db } from "../../db";
import { organizationAiProviderConfig } from "../../db/schema";

export type AiProviderCatalogItem = {
  id: string;
  name: string;
  kind: "workers-ai" | "openai-compatible";
  baseUrl?: string;
  models: Array<{ id: string; name: string }>;
  requiresApiKey: boolean;
};

export const providerCatalog: AiProviderCatalogItem[] = [
  {
    id: "cloudflare-workers-ai",
    name: "Cloudflare Workers AI",
    kind: "workers-ai",
    requiresApiKey: false,
    models: [
      { id: "@cf/openai/gpt-oss-120b", name: "GPT OSS 120B" },
      { id: "@cf/openai/gpt-oss-20b", name: "GPT OSS 20B" },
      { id: "@cf/moonshotai/kimi-k2.5", name: "Kimi K2.5" },
      { id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast", name: "Llama 3.3 70B" },
      { id: "@cf/zai-org/glm-4.7-flash", name: "GLM 4.7 Flash" },
    ],
  },
  openAiCompatible("openai", "OpenAI", "https://api.openai.com/v1", [
    ["gpt-5.2", "GPT-5.2"],
    ["gpt-5.2-mini", "GPT-5.2 Mini"],
    ["gpt-4.1", "GPT-4.1"],
  ]),
  openAiCompatible("openrouter", "OpenRouter", "https://openrouter.ai/api/v1", [
    ["openai/gpt-5.2", "GPT-5.2"],
    ["anthropic/claude-sonnet-4.5", "Claude Sonnet 4.5"],
    ["google/gemini-2.5-pro", "Gemini 2.5 Pro"],
  ]),
  openAiCompatible("google-ai-studio", "Google AI Studio", "https://generativelanguage.googleapis.com/v1beta/openai", [
    ["gemini-2.5-pro", "Gemini 2.5 Pro"],
    ["gemini-2.5-flash", "Gemini 2.5 Flash"],
  ]),
  openAiCompatible("custom", "Custom / Community", undefined, [
    ["model-id", "Custom model"],
  ]),
];

export async function listAiProviderConfigs(organizationId: string) {
  const rows = await db
    .select()
    .from(organizationAiProviderConfig)
    .where(eq(organizationAiProviderConfig.organizationId, organizationId));
  const byProvider = new Map(rows.map((row) => [row.providerId, row]));

  return providerCatalog.map((provider) => {
    const row = byProvider.get(provider.id);

    return {
      apiKeyConfigured: Boolean(row?.apiKey),
      baseUrl: row?.baseUrl ?? provider.baseUrl ?? "",
      enabled:
        row?.enabled ??
        (provider.id === "cloudflare-workers-ai" && isCloudflareWorkersAiAvailable()),
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
  organizationId: string,
  providerId: string,
) {
  const [row] = await db
    .select()
    .from(organizationAiProviderConfig)
    .where(
      and(
        eq(organizationAiProviderConfig.organizationId, organizationId),
        eq(organizationAiProviderConfig.providerId, providerId),
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
    kind: "openai-compatible",
    baseUrl,
    requiresApiKey: true,
    models: models.map(([modelId, modelName]) => ({ id: modelId, name: modelName })),
  };
}

function isCloudflareWorkersAiAvailable() {
  return true;
}
