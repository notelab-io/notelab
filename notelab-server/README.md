# Notelab Server

```sh
npm install
npm run db:migrate
npm run dev
```

`npm run dev` starts the Cloudflare Worker locally on port `3000` with the AI
and Hyperdrive bindings.

## Cloudflare Production

Production database traffic goes through the `HYPERDRIVE` binding in
`wrangler.jsonc`. In `wrangler dev`, Hyperdrive uses the configured
`CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` environment
variable; in production, it uses the Cloudflare Hyperdrive configuration ID.

The local Hyperdrive connection string must include a password:

```sh
export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="postgres://USER:PASSWORD@localhost:5432/notelab"
```

`wrangler dev` connects directly to that database and does not use Hyperdrive
pooling or query caching locally. Use `wrangler dev --remote` only when you
explicitly want to test the deployed Hyperdrive configuration against remote
resources.

Create or replace the Hyperdrive config with the production Postgres URL:

```sh
npx wrangler hyperdrive create notelab-main --connection-string="$PRODUCTION_DATABASE_URL"
```

Put the returned ID in `wrangler.jsonc` under `hyperdrive[0].id`, then deploy:

```sh
npm run deploy
```

Set production secrets with Wrangler prompts:

```sh
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put OAUTH_STATE_SECRET
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put SLACK_OAUTH_CLIENT_SECRET
npx wrangler secret put LINEAR_OAUTH_CLIENT_SECRET
```

Generate/synchronize Worker binding types when the Wrangler config changes:

```sh
npm run cf-typegen
```
