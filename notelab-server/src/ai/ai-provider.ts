import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { and, eq } from "drizzle-orm";
import { createWorkersAI } from "workers-ai-provider";

import { db } from "../db";
import { organizationAiProviderConfig } from "../db/schema";
import type { WorkersAiBinding } from "../types";

export class AiProviderConfigError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AiProviderConfigError";
    this.status = status;
  }
}

export async function resolveOrganizationAiModel(
  organizationId: string,
  selectedModelId?: string,
  workersAiBinding?: WorkersAiBinding,
) {
  const { providerId, modelId } = parseSelectedModelId(selectedModelId);

  if (providerId === "cloudflare-workers-ai") {
    const workersai = createWorkersAiProvider(workersAiBinding);

    return workersai(modelId || "@cf/openai/gpt-oss-120b", {
      reasoning_effort: "low",
    });
  }

  const [config] = await db
    .select()
    .from(organizationAiProviderConfig)
    .where(
      and(
        eq(organizationAiProviderConfig.organizationId, organizationId),
        eq(organizationAiProviderConfig.providerId, providerId),
      ),
    )
    .limit(1);

  if (!config?.enabled) {
    throw new AiProviderConfigError("This AI provider is not enabled.", 403);
  }

  if (!config.apiKey) {
    throw new AiProviderConfigError("Add an API key before using this provider.");
  }

  const baseURL = normalizeOpenAiBaseUrl(
    config.baseUrl || getProviderBaseUrl(providerId),
  );

  if (!baseURL) {
    throw new AiProviderConfigError("Add a base URL before using this provider.");
  }

  const provider = createOpenAICompatible({
    apiKey: normalizeApiKey(config.apiKey),
    baseURL,
    includeUsage: true,
    name: providerId,
  });

  return provider.chatModel(modelId);
}

function parseSelectedModelId(selectedModelId?: string) {
  if (!selectedModelId) {
    return {
      providerId: "cloudflare-workers-ai",
      modelId: "@cf/openai/gpt-oss-120b",
    };
  }

  const separatorIndex = selectedModelId.indexOf(":");

  if (separatorIndex === -1) {
    return {
      providerId: "cloudflare-workers-ai",
      modelId: selectedModelId,
    };
  }

  return {
    providerId: selectedModelId.slice(0, separatorIndex),
    modelId: selectedModelId.slice(separatorIndex + 1),
  };
}

function getProviderBaseUrl(providerId: string) {
  return (
    {
      custom: undefined,
      "google-ai-studio": "https://generativelanguage.googleapis.com/v1beta/openai",
      openai: "https://api.openai.com/v1",
      openrouter: "https://openrouter.ai/api/v1",
    } satisfies Record<string, string | undefined>
  )[providerId];
}

function normalizeOpenAiBaseUrl(baseUrl?: string | null) {
  return baseUrl?.trim().replace(/\/$/, "");
}

function normalizeApiKey(apiKey: string) {
  return apiKey.trim().replace(/^Bearer\s+/i, "");
}

function createWorkersAiProvider(workersAiBinding?: WorkersAiBinding) {
  if (workersAiBinding) {
    return createWorkersAI({ binding: workersAiBinding as never });
  }

  throw new AiProviderConfigError(
    "Cloudflare Workers AI is only available through the Worker AI binding. Run npm run dev or deploy the Worker.",
    503,
  );
}
