# Deploy Current Branch To Dokploy With GHCR

This guide deploys the current branch, `deploy/vps`, as one GHCR image.

The image contains:

- the Bun API server
- the built Vite web app
- Drizzle migrations for both databases

Dokploy only needs one application:

```text
ghcr.io/projet-pluridisciplinaire-2cp/doctor-com-app:deploy-vps
```

The container exposes port `3000`.

## 1. Push This Branch To GitHub

From the repo root:

```bash
git status
git add .
git commit -m "chore: deploy app as single ghcr image"
git push -u origin deploy/vps
```

If `origin` is not configured yet:

```bash
git remote add origin https://github.com/projet-pluridisciplinaire-2CP/YOUR_REPO_NAME.git
git push -u origin deploy/vps
```

## 2. Create The GHCR Token

Because the repository is inside the `projet-pluridisciplinaire-2CP` organization and `Read and write permissions` is blocked, use a GitHub Personal Access Token.

Create the token from your own GitHub account:

```text
Your profile -> Settings -> Developer settings -> Personal access tokens -> Tokens (classic)
```

Scopes:

```text
repo
read:packages
write:packages
```

If the organization uses SSO, authorize the token for:

```text
projet-pluridisciplinaire-2CP
```

## 3. Add The Token To The Org Repo

Open the GitHub repository in the organization:

```text
Repository -> Settings -> Secrets and variables -> Actions -> New repository secret
```

Create:

```text
Name: GHCR_TOKEN
Value: your GitHub token
```

## 4. Publish The GHCR Image

Open:

```text
Repository -> Actions -> Publish GHCR Images
```

Run the workflow on branch:

```text
deploy/vps
```

When it succeeds, you should have:

```text
ghcr.io/projet-pluridisciplinaire-2cp/doctor-com-app:deploy-vps
```

GitHub lowercases the organization name for GHCR.

## 5. Make The Package Pullable By Dokploy

Public package option:

1. Open the GitHub organization package `doctor-com-app`.
2. Go to package settings.
3. Change package visibility to public.

Private package option:

1. Create a GitHub token with `read:packages`.
2. In Dokploy, add a registry:

```text
Registry: ghcr.io
Username: YOUR_GITHUB_USERNAME
Password: YOUR_READ_PACKAGES_TOKEN
```

## 6. Create One Dokploy App

In Dokploy, create an application from Docker image.

Image:

```text
ghcr.io/projet-pluridisciplinaire-2cp/doctor-com-app:deploy-vps
```

Port:

```text
3000
```

Domain:

```text
https://your-domain.com
```

Health check path:

```text
/healthz
```

## 7. Set Environment Variables In Dokploy

Use one public domain for both web and API:

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://USER:PASSWORD@MAIN_POSTGRES_HOST:5432/doctor_com
MEDICATIONS_DATABASE_URL=postgresql://USER:PASSWORD@MEDICATIONS_POSTGRES_HOST:5432/doctor_com_medicaments

BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters
BETTER_AUTH_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com

MINIO_ENDPOINT=MINIO_HOST
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ROOT_USER=MINIO_USER
MINIO_ROOT_PASSWORD=MINIO_PASSWORD
MINIO_BUCKET=doctorcom-documents

AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_KEY
GEMINI_MODEL=gemini-2.5-flash

OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=gemma4:e2b
OLLAMA_TIMEOUT_MS=60000

SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
SMTP_FROM=no-reply@your-domain.com
```

Important:

- `DATABASE_URL` points to your main Postgres instance.
- `MEDICATIONS_DATABASE_URL` points to your medications Postgres instance.
- `MINIO_ENDPOINT` should be only a hostname, without `http://`.
- `BETTER_AUTH_URL` and `CORS_ORIGIN` should both be the same single Dokploy app domain.
- You do not need `APP_SERVER_URL` for this single-image setup. The web app falls back to the same origin.

## 8. Deploy Order

Deploy in this order:

1. Main Postgres is running.
2. Medications Postgres is running.
3. MinIO is running.
4. Dokploy app `doctor-com-app` is deployed.
5. Open `https://your-domain.com/healthz`.
6. Open `https://your-domain.com`.

Expected health response:

```text
server running
```

## 9. Updating Later

After code changes:

```bash
git add .
git commit -m "your change"
git push origin deploy/vps
```

Wait for the GitHub Action to finish, then redeploy this image in Dokploy:

```text
ghcr.io/projet-pluridisciplinaire-2cp/doctor-com-app:deploy-vps
```
