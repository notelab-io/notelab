# Self-Hosting Notelab

Notelab self-hosting is a Docker Compose deployment with one public URL. Caddy
terminates HTTP/HTTPS and proxies to the combined Notelab web/API container.
Postgres stores relational data, and MinIO stores uploaded images through the
same S3-compatible path used by hosted object storage.

## Quick Start

For local evaluation:

```sh
docker compose up -d
```

Open:

```text
http://localhost
```

For a public deployment, copy the example env file and edit every secret:

```sh
cp .env.selfhost.example .env
```

Set:

```text
NOTELAB_SITE_ADDRESS=notes.example.com
CLIENT_URL=https://notes.example.com
BETTER_AUTH_URL=https://notes.example.com
```

Then start the stack:

```sh
docker compose up -d
```

Caddy will request and renew TLS certificates automatically when the domain
points at the host and ports 80/443 are reachable.

## Services

- `caddy`: public HTTP/HTTPS entrypoint.
- `notelab`: combined Vite client and Node/Hono serverful API.
- `postgres`: application database.
- `minio`: S3-compatible object storage for uploads.
- `minio-init`: creates the Notelab bucket on startup.

MinIO is mandatory in the Docker self-host stack. Notelab uses:

```text
IMAGE_STORAGE_MODE=s3
R2_ENDPOINT=http://minio:9000
R2_BUCKET_NAME=notelab
```

## Email

If `RESEND_API_KEY` is not set, Notelab prints verification emails, one-time
codes, and magic links to the app logs:

```sh
docker compose logs -f notelab
```

Set `RESEND_API_KEY` and `EMAIL_FROM` to send real emails.

## Health

Check the public health endpoint:

```sh
curl http://localhost/health
```

Check container status:

```sh
docker compose ps
```

## Backups

Back up Postgres:

```sh
docker compose exec postgres pg_dump -U notelab notelab > notelab-postgres.sql
```

Back up MinIO data by snapshotting the `minio_data` Docker volume or copying
objects with an S3-compatible client.

The persistent volumes are:

```text
postgres_data
minio_data
caddy_data
caddy_config
```

## Upgrades

Pull the latest code or image, then rebuild and restart:

```sh
docker compose build
docker compose up -d
```

The Notelab container runs database migrations before starting the server.

## Troubleshooting

View app logs:

```sh
docker compose logs -f notelab
```

View Caddy logs:

```sh
docker compose logs -f caddy
```

If public auth redirects or cookies fail, confirm these values all use the same
external origin:

```text
NOTELAB_SITE_ADDRESS
CLIENT_URL
BETTER_AUTH_URL
```

If image uploads fail, confirm MinIO is healthy and the bucket init completed:

```sh
docker compose ps minio minio-init
```
