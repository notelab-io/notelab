# Notelab Server

```sh
npm install
npm run db:migrate
npm run dev
```

`npm run dev` starts the normal Node/serverful backend on port `3000`.

## Realtime Collaboration

Editable page bodies use Yjs through Hocuspocus. Run the latest Drizzle
migrations before starting the server. The Node runtime serves the collaboration
WebSocket at `/collaboration`; clients obtain short-lived page-scoped tickets
from `POST /pages/:id/collaboration-ticket`.

`COLLABORATION_SECRET` is optional and falls back to `BETTER_AUTH_SECRET`. Set
it separately when collaboration tickets should have an independent signing
key. Set `COLLABORATION_WEBSOCKET_URL` when the public WebSocket origin cannot
be derived from the API request URL, such as behind a development proxy.

## Deployment Adapters

Cloudflare deployment support lives in the private
`@notelab-io/cloudflare-adapter` package. The open-source server exports its
adapter integration surface from `@notelab/server/adapter-api`, so the public
repo can install and run without GitHub Packages credentials.

The adapter API exports the Hocuspocus factory, ticket helpers, Yjs conversion
helpers, and collaboration runtime callbacks. Hosted Cloudflare deployments
should route one page document to one deterministic Durable Object and provide
their public WebSocket URL through `getCollaborationWebSocketUrl`.
