import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type ModelMessage,
  type ToolSet,
  type UIMessage,
} from "ai";
import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import * as z from "zod";

import { AiProviderConfigError, resolveOrganizationAiModel } from "../ai/ai-provider";
import { buildGithubTools } from "../ai/ask-ai-github-tools";
import { buildGmailTools } from "../ai/ask-ai-gmail-tools";
import { buildGoogleCalendarTools } from "../ai/ask-ai-google-calendar-tools";
import { buildGoogleDriveTools } from "../ai/ask-ai-google-drive-tools";
import { buildLinearTools } from "../ai/ask-ai-linear-tools";
import { buildSlackTools } from "../ai/ask-ai-slack-tools";
import { getMembership } from "../access";
import { db } from "../db";
import { organizationIntegration } from "../db/schema";
import type { AppBindings } from "../types";

type SourceId =
  | "gmail"
  | "github"
  | "google-calendar"
  | "google-drive"
  | "slack"
  | "linear";

type CalendarAccess = {
  accessToken: string;
  coworkerCalendarAccessEnabled: boolean;
};

const askAiRequestSchema = z
  .object({
    apiKey: z.string().trim().optional(),
    messages: z.array(z.unknown()).default([]),
    model: z.string().trim().optional(),
    prompt: z.string().trim().optional(),
    sources: z
      .array(
        z.enum([
          "gmail",
          "github",
          "google-calendar",
          "google-drive",
          "slack",
          "linear",
        ]),
      )
      .default([])
      .transform((sources) => Array.from(new Set(sources))),
  })
  .refine((value) => value.prompt || value.messages.length > 0, {
    message: "Either prompt or messages is required",
  });

export const aiRoutes = new Hono<AppBindings>();

aiRoutes.post("/ask", async (c) => {
  const auth = await requireActiveOrganization(c);

  if ("response" in auth) {
    return auth.response;
  }

  const body = await parseJson(c, askAiRequestSchema);

  if (!body.success) {
    return body.response;
  }

  const connections = await getIntegrationConnections(auth.organizationId);

  if (
    !connections.gmail &&
    !connections.github &&
    !connections.googleCalendar &&
    !connections.googleDrive &&
    !connections.slack &&
    !connections.linear
  ) {
    return c.json(
      {
        code: "ASK_AI_INTEGRATION_NOT_CONNECTED",
        message:
          "Connect Gmail, GitHub, Google Calendar, Google Drive, Slack, or Linear before asking workspace integration questions.",
      },
      409,
    );
  }

  const messages = await toModelMessages(body.data.messages, body.data.prompt);

  if (!messages.success) {
    return messages.response;
  }

  const sourceFilter = new Set(body.data.sources);
  const shouldUseSource = (source: SourceId) =>
    sourceFilter.size === 0 || sourceFilter.has(source);

  const tools: ToolSet = {
    ...(connections.gmail && shouldUseSource("gmail")
      ? buildGmailTools(connections.gmail)
      : {}),
    ...(connections.github && shouldUseSource("github")
      ? buildGithubTools(connections.github)
      : {}),
    ...(connections.googleCalendar && shouldUseSource("google-calendar")
      ? buildGoogleCalendarTools(connections.googleCalendar)
      : {}),
    ...(connections.googleDrive && shouldUseSource("google-drive")
      ? buildGoogleDriveTools(connections.googleDrive)
      : {}),
    ...(connections.slack && shouldUseSource("slack")
      ? buildSlackTools(connections.slack)
      : {}),
    ...(connections.linear && shouldUseSource("linear")
      ? buildLinearTools(connections.linear)
      : {}),
  };

  if (Object.keys(tools).length === 0) {
    return c.json(
      {
        code: "ASK_AI_SELECTED_SOURCES_NOT_CONNECTED",
        message:
          "The selected sources are not connected. Add a connected source or remove the source filter.",
      },
      409,
    );
  }

  try {
    const model = await resolveOrganizationAiModel(
      auth.organizationId,
      body.data.model,
      c.env.AI,
    );
    const result = streamText({
      abortSignal: c.req.raw.signal,
      maxOutputTokens: 1600,
      messages: messages.data,
      model,
      stopWhen: stepCountIs(5),
      system: [
        "You are Notelab's workspace research assistant.",
        "Use Gmail tools when the user asks about email, inbox, people, timelines, project updates, decisions, blockers, or messages from email.",
        "Use GitHub tools when the user asks about repositories, issues, pull requests, commits, branches, files, code, releases, bugs, reviews, or work tracked in GitHub.",
        "Use Google Calendar tools when the user asks about meetings, schedules, events, availability, free/busy windows, calendars, attendees, or time-based planning.",
        "Use Google Drive tools when the user asks about Drive files, Docs, Sheets, Slides, documents, folders, file owners, recently changed files, or content stored in Google Drive.",
        "Use Slack tools for organization Slack context only: channels, private channels the Notelab app can access, threads, canvases, files, project chatter, decisions, blockers, and workspace messages.",
        "Use Linear tools when the user asks about issues, tickets, bugs, tasks, projects, teams, cycles, status, assignees, priorities, blockers, scope, delivery progress, or roadmap work tracked in Linear.",
        body.data.sources.length
          ? `Only use these selected sources for this request: ${body.data.sources.join(", ")}. Do not use tools from unselected sources.`
          : "If the user has not selected sources for this request, choose among all connected Gmail, GitHub, Google Calendar, Google Drive, Slack, and Linear tools as needed.",
        "The connected organization tools are read-only. Never claim you sent, modified, archived, labeled, deleted, drafted, posted, updated, assigned, commented on, scheduled, canceled, merged, closed, reopened, reviewed, uploaded, moved, shared, or marked any Gmail, GitHub, Google Calendar, Google Drive, Slack, or Linear item.",
        "Prefer concise answers with dates, participants, links, and message subjects when useful.",
        "If the available integration results are insufficient, say what is missing and suggest a narrower query.",
      ].join("\n"),
      temperature: 0.2,
      tools,
      onError: ({ error }) => {
        console.warn("Ask AI stream provider error", toProviderErrorMessage(error));
      },
    });

    return result.toUIMessageStreamResponse({
      onError: (error) => toProviderErrorMessage(error),
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return new Response(null, { status: 408 });
    }

    if (error instanceof AiProviderConfigError) {
      return Response.json(
        { error: error.message, message: error.message },
        { status: error.status },
      );
    }

    console.error("Ask AI integration request failed", error);

    return c.json({ error: "Failed to process integration AI request" }, 500);
  }
});

async function requireActiveOrganization(c: Context<AppBindings>) {
  const user = c.get("user");
  const session = c.get("session");
  const organizationId =
    session?.activeOrganizationId ??
    c.req.header("x-notelab-organization-id")?.trim();

  if (!user) {
    return { response: c.json({ error: "Unauthorized" }, 401) };
  }

  if (!organizationId) {
    return { response: c.json({ error: "No active organization" }, 409) };
  }

  if (!(await getMembership(organizationId, user.id))) {
    return { response: c.json({ error: "Forbidden" }, 403) };
  }

  return { organizationId, user };
}

async function getIntegrationConnections(organizationId: string) {
  const rows = await db
    .select()
    .from(organizationIntegration)
    .where(
      and(
        eq(organizationIntegration.organizationId, organizationId),
        eq(organizationIntegration.status, "connected"),
      ),
    );
  const byKey = new Map(rows.map((row) => [row.integrationKey, row]));
  const googleCalendar = byKey.get("google-calendar");

  return {
    gmail: byKey.get("gmail")?.accessToken,
    github: byKey.get("github")?.accessToken,
    googleCalendar: googleCalendar
      ? ({
          accessToken: googleCalendar.accessToken,
          coworkerCalendarAccessEnabled: Boolean(
            readObject(googleCalendar.metadata).coworkerCalendarAccessEnabled,
          ),
        } satisfies CalendarAccess)
      : undefined,
    googleDrive: byKey.get("google-drive")?.accessToken,
    linear: byKey.get("linear")?.accessToken,
    slack: byKey.get("slack")?.accessToken,
  };
}

async function toModelMessages(rawMessages: unknown[], prompt?: string): Promise<
  | { success: true; data: ModelMessage[] }
  | { success: false; response: Response }
> {
  if (rawMessages.length === 0 && prompt) {
    return {
      success: true,
      data: [{ content: prompt, role: "user" }],
    };
  }

  try {
    return {
      success: true,
      data: await convertToModelMessages(rawMessages as UIMessage[]),
    };
  } catch {
    return {
      success: false,
      response: Response.json(
        { code: "VALIDATION_ERROR", message: "Invalid AI messages" },
        { status: 400 },
      ),
    };
  }
}

async function parseJson<T extends z.ZodType>(
  c: Context<AppBindings>,
  schema: T,
): Promise<
  | { success: true; data: z.infer<T> }
  | { success: false; response: Response }
> {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return {
      success: false,
      response: Response.json(
        { code: "BAD_REQUEST", message: "Invalid JSON body" },
        { status: 400 },
      ),
    };
  }

  const result = schema.safeParse(body);

  if (!result.success) {
    return {
      success: false,
      response: Response.json(
        {
          code: "VALIDATION_ERROR",
          issues: result.error.issues,
          message: "Invalid request body",
        },
        { status: 400 },
      ),
    };
  }

  return { success: true, data: result.data };
}

function readObject(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function toProviderErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "The AI provider failed while processing this request.";
}
