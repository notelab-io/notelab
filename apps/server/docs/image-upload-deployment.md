# Image Upload Deployment Runbook

This server supports image uploads backed by Cloudflare R2. The application metadata stays in Postgres in the `image_asset` table; the image bytes are stored in R2.

There are two storage modes:

- `binding`: the Worker reads/writes R2 through the `IMAGE_BUCKET` binding. This is the fully local mode in `wrangler dev` because Wrangler simulates R2 storage locally.
- `s3`: the server creates S3-compatible presigned URLs for R2. This is useful when local development should exercise the same direct-to-R2 upload path as production.

## Important Permission Model

R2 and the R2 S3-compatible API do not know about Notelab organizations, workspaces, or users. Workspace access is enforced by the server routes before issuing an upload URL, completing an upload, reading an image, or deleting an image.

Do not expose raw R2 credentials to the browser. The browser should only receive short-lived upload/read URLs generated after the server checks workspace permissions.

## Local Development

Use binding mode when you want everything local:

```sh
cd apps/server
cp .env.example .env
```

Set these values in `.env`:

```sh
IMAGE_STORAGE_MODE=binding
IMAGE_UPLOAD_MAX_BYTES=10485760
IMAGE_UPLOAD_URL_TTL_SECONDS=600
IMAGE_READ_URL_TTL_SECONDS=300
R2_BUCKET_NAME=notelab-images
```

Then run:

```sh
npm install
npm run db:migrate
npm run dev
```

In this mode, R2 data is stored by Wrangler under `.wrangler/state`. It does not require Cloudflare R2 credentials.

Use S3 mode locally only when you intentionally want to hit real Cloudflare R2:

```sh
IMAGE_STORAGE_MODE=s3
R2_ACCOUNT_ID=your-cloudflare-account-id
R2_BUCKET_NAME=notelab-images
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
# Optional. Defaults to https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com
R2_ENDPOINT=
```

S3 mode is not fully local. It talks to Cloudflare R2 over the S3-compatible API.

## Production Resource Setup

Create the production R2 bucket:

```sh
npx wrangler r2 bucket create notelab-images
```

Create the preview/dev bucket if you plan to use remote preview resources:

```sh
npx wrangler r2 bucket create notelab-images-dev
```

Confirm the bucket binding exists in `wrangler.jsonc`:

```jsonc
"r2_buckets": [
  {
    "binding": "IMAGE_BUCKET",
    "bucket_name": "notelab-images",
    "preview_bucket_name": "notelab-images-dev"
  }
]
```

Generate Worker binding types after config changes:

```sh
npm run cf-typegen
```

## Choose Production Storage Mode

Recommended production mode is `binding` unless direct browser-to-R2 uploads are required.

For binding mode:

- Do not set `IMAGE_STORAGE_MODE=s3`.
- No R2 S3 access key is needed.
- The Worker handles upload and read traffic through `/images/...`.
- R2 bucket CORS is not required for image uploads because the browser only talks to the API origin.

For S3 mode:

- Set `IMAGE_STORAGE_MODE=s3`.
- Create a Cloudflare R2 API token/access key with object read/write access for the image bucket.
- Store the R2 key ID and secret as Worker secrets.
- Configure R2 bucket CORS so the browser can `PUT` directly to R2 presigned URLs.

## Production Environment Variables

These non-secret values are tracked in `wrangler.jsonc`:

```jsonc
"IMAGE_READ_URL_TTL_SECONDS": "300",
"IMAGE_UPLOAD_MAX_BYTES": "10485760",
"IMAGE_UPLOAD_URL_TTL_SECONDS": "600",
"R2_BUCKET_NAME": "notelab-images"
```

If production should force a mode, add one of these to `vars`:

```jsonc
"IMAGE_STORAGE_MODE": "binding"
```

or:

```jsonc
"IMAGE_STORAGE_MODE": "s3"
```

If `IMAGE_STORAGE_MODE` is omitted, the server uses S3 only when all required S3 settings are present; otherwise it falls back to the R2 binding.

## Production Secrets

Set application secrets with Wrangler prompts:

```sh
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put OAUTH_STATE_SECRET
npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
npx wrangler secret put GITHUB_OAUTH_CLIENT_SECRET
npx wrangler secret put SLACK_OAUTH_CLIENT_SECRET
npx wrangler secret put LINEAR_OAUTH_CLIENT_SECRET
```

Only for `IMAGE_STORAGE_MODE=s3`, also set:

```sh
npx wrangler secret put R2_ACCOUNT_ID
npx wrangler secret put R2_ACCESS_KEY_ID
npx wrangler secret put R2_SECRET_ACCESS_KEY
```

If using a custom R2 endpoint, set:

```sh
npx wrangler secret put R2_ENDPOINT
```

Do not put secret values in `wrangler.jsonc`, `.env.example`, or committed docs.

## R2 CORS For S3 Mode

S3 mode requires R2 bucket CORS because the browser uploads directly to the R2 presigned URL.

Review and update allowed origins in:

```sh
docs/r2-cors.example.json
```

Then apply it:

```sh
npx wrangler r2 bucket cors set notelab-images --file docs/r2-cors.example.json
```

Verify:

```sh
npx wrangler r2 bucket cors list notelab-images
```

Binding mode does not need this CORS file.

## Database Migration

Image metadata requires the `image_asset` table migration:

```sh
npm run db:migrate
```

Before production deploy, run the migration against the production Postgres database using a secure local environment or CI secret for `DATABASE_URL`.

## Build And Deploy

Run local checks:

```sh
npm run build
```

Run a Worker deploy dry run:

```sh
npx wrangler deploy --dry-run
```

Deploy:

```sh
npm run deploy
```

Watch logs after deploy:

```sh
npx wrangler tail
```

## Smoke Test

1. Sign in to the app.
2. Open a workspace where the user has edit access.
3. Upload an image in an editor image block or image file cell.
4. Confirm the upload route returns an `assetId`.
5. Confirm the upload body request succeeds:
   - binding mode: `PUT /images/uploads/:assetId/body`
   - S3 mode: `PUT` to a Cloudflare R2 presigned URL
6. Confirm `POST /images/uploads/:assetId/complete` succeeds.
7. Reload the page and confirm the image renders from `/images/:assetId`.
8. Test a user without workspace access and confirm image read/upload/delete routes are denied.

## Rollback

If deployment fails after release:

```sh
npx wrangler versions list
npx wrangler rollback
```

If the failure is only S3 configuration, switch back to binding mode by removing `IMAGE_STORAGE_MODE=s3` or setting `IMAGE_STORAGE_MODE=binding`, then redeploy.

## Troubleshooting

`Missing R2 S3 configuration for IMAGE_STORAGE_MODE=s3`

The server is in S3 mode but required R2 S3 values are missing. For fully local development, set `IMAGE_STORAGE_MODE=binding`. For S3 mode, set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET_NAME`.

`Failed to fetch` on `PUT /images/uploads/:assetId/body`

Check that the frontend API URL points to the local Worker during local development and restart both dev servers after changing environment variables.

Browser CORS error on a Cloudflare R2 URL

This only applies to S3 mode. Update `docs/r2-cors.example.json` with the frontend origin and apply it with `npx wrangler r2 bucket cors set notelab-images --file docs/r2-cors.example.json`.

Uploaded image metadata exists but image does not render

Check Worker logs with `npx wrangler tail`, verify the object exists in R2, and confirm the current user has view access to the workspace recorded on the image asset.
