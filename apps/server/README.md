# Zilobase Server

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

## Runtime Integrations

The server exports an integration surface from `@zilobase/server/adapter-api`.
It includes the Hocuspocus factory, ticket helpers, Yjs conversion helpers, and
collaboration runtime callbacks for alternate runtimes.
