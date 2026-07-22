# OpenAI Build Week 2026 — Zilobase

## Project story

### About the project

Work rarely lives in one place. The plan is in a document, the backlog is in a
tracker, decisions are in chat and email, meetings are on a calendar, and the
implementation is in GitHub. Even when an AI assistant can access one of those
systems, people still have to reconstruct the surrounding context before it can
help.

**Zilobase** is an open-source collaborative workspace that brings pages,
structured databases, comments, realtime editing, AI workflows, and connected
tools into one coherent product. A user can write a project brief, attach a
database, ask questions about the current page, bring in live context from an
external service, and apply an approved edit without leaving the workspace.

### Inspiration

I built Zilobase because knowledge tools and work systems have drifted apart.
Documents are flexible but lose structure; trackers have structure but lose the
reasoning around the work; assistants are useful but often lack either source.
The idea was to let pages and databases provide durable context while connected
tools provide current context.

### What I built during Build Week

Zilobase existed as an open-source workspace before the challenge. During Build
Week, I focused on making its AI experience genuinely connected rather than
claiming the entire product was created in a week.

I integrated the standalone Toolkit platform and `@zilobase/toolkit` SDK into
Zilobase. Workspace members can manage connections for GitHub, Gmail, Google
Calendar, Google Drive, Slack, and Linear from settings. The server maps each
Zilobase workspace/user pair to an isolated Toolkit user, loads tools only for
active accounts and selected sources, and exposes external integrations as
read-only tools to chat.

The chat service combines those tools with page and database context. Existing
Zilobase mutation paths remain responsible for page and database edits, so
normal workspace authorization still applies. Tool presentation metadata is
rendered in the chat UI without adding progress copy to model prompts.

### How it was built

The web application uses React, TypeScript, Tiptap, TanStack Query, and Yjs. The
Hono server uses PostgreSQL and Drizzle for persistence, Better Auth for
identity, and the Vercel AI SDK for streaming tool-enabled chat. The public
self-hosted stack runs with Docker Compose, Caddy, PostgreSQL, and MinIO.

For Build Week, the integration was implemented across the server, shared query
hooks, settings experience, chat tool construction, and hosted runtime
configuration. The Toolkit SDK keeps its project key on the server, retrieves a
remote catalog for the current user, and converts only the allowed read tools
into the chat tool set.

### Challenges

The main challenge was combining two different kinds of context safely. Page
context is a durable snapshot owned by Zilobase; integration results are live
data owned by an external provider. The assistant must know when to use each,
must not imply an external write occurred, and must not expose another
workspace's connection.

The integration also crosses several product boundaries: OAuth begins in
Zilobase, completes in Toolkit, and returns to the correct settings page; server
errors need useful UI states; and model tool calls need consistent progress and
result presentation. Focused tests around account selection, source filtering,
metadata parsing, query invalidation, and authorization helped keep that flow
predictable.

### What I learned

I learned that an AI workspace benefits more from carefully selected tools than
from exposing every possible capability. Read-only external tools are a strong
default, while workspace edits should continue through the application's own
authorization and mutation model. I also learned that separating tool intent
from UI presentation makes both the prompt and the interface clearer.

### How Codex and GPT-5.6 were used

Codex running GPT-5.6 was the primary Build Week engineering collaborator. I
used it to trace the existing architecture, plan the Toolkit extraction and
integration boundaries, implement server and UI changes across the monorepo,
review prompt and permission behavior, diagnose cross-runtime issues, add
regression tests, and run the complete server/web verification loop.

The key decisions remained human-controlled: Zilobase would stay independently
self-hostable; external integrations would be read-only in chat; the Toolkit
project key would never reach the browser; workspace/user isolation would be
encoded into every Toolkit user ID; and existing Zilobase authorization paths
would own edits. The primary `/feedback` Codex session ID is supplied directly
in Devpost rather than committed to the repository.

## Built with

`Productivity`, `Knowledge Management`, `Collaboration`, `AI Assistant`,
`OpenAI`, `GPT-5.6`, `Codex`, `TypeScript`, `React`, `Hono`, `PostgreSQL`,
`Tiptap`, `Yjs`, `Real-Time Collaboration`, `Databases`, `Notes`, `Self-Hosted`,
`Docker`, `Tool Calling`, `Integrations`, `Workflow Automation`, `Open Source`,
`TanStack Query`, `Vercel AI SDK`

## Installation and supported platforms

### Fastest judge path

Open [app.zilobase.com](https://app.zilobase.com) in a modern desktop browser.
Use the judge account supplied in Devpost's private testing notes when provided,
or create an account through the normal hosted flow.

### Self-hosted installation

Requirements: Docker and Docker Compose on Linux, macOS, or Windows through
Docker Desktop.

```sh
cp .env.selfhost.example .env
docker compose up -d --build
```

Open `http://localhost`. Replace every example secret before exposing the stack
to the internet.

### Development

Requirements: Node.js 22 or newer and npm.

```sh
npm install
npm run dev:server
npm run dev:web
```

## Judge testing

1. Open or create a workspace and add a page containing a short project brief.
2. Add an inline or standalone database with a few tasks, owners, and statuses.
3. Open AI chat from the page and ask a question that requires both the page and
   database context.
4. Open **Settings → Integrations**, connect one supported external source, and
   return to chat.
5. Select that source and ask a read-only question, such as summarizing recent
   GitHub issues or finding a calendar event relevant to the page.
6. Ask Zilobase to update the page or database and confirm that the change goes
   through Zilobase's authorized edit tools rather than an external write.
7. Verify the repository:

   ```sh
   npm run build:server
   npm run test:web
   npm run build:web
   ```

Private credentials, provider test accounts, API keys, and `/feedback` IDs are
supplied only in Devpost's private testing notes.

## Demo video outline (under three minutes)

1. **0:00–0:25 — Problem:** show a project split across a brief, task tracker,
   email or calendar, and code.
2. **0:25–0:55 — Workspace:** open the same project as a Zilobase page with an
   embedded database and comments.
3. **0:55–1:25 — Contextual AI:** ask a question that uses the current page and
   database.
4. **1:25–1:55 — Connect:** open integration settings and show the Toolkit-backed
   connection flow.
5. **1:55–2:25 — Live source:** ask a read-only question that combines the page
   with GitHub, Gmail, Calendar, Drive, Slack, or Linear context.
6. **2:25–2:55 — Build process:** show the verification suite and explain how
   Codex with GPT-5.6 accelerated the cross-repository implementation and review.

## Submission checklist

- Work & Productivity category selected.
- Public repository, hosted app, and self-host instructions included.
- Public YouTube demo is shorter than three minutes.
- Demo audio explains both Codex and GPT-5.6 usage.
- Judge credentials are placed only in private Devpost testing notes.
- Zilobase `/feedback` session ID pasted into Devpost, not committed to Git.

