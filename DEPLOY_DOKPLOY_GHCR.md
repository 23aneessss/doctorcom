# Deploy Current Branch To Dokploy With GHCR

This guide deploys the current branch, `deploy/vps`, to a VPS that already has Dokploy, two Postgres instances, MinIO, and an app slot where you want to run GHCR images.

The app should be deployed as two Dokploy applications:

- `doctor-com-server`: Bun API, port `3000`
- `doctor-com-web`: Vite static frontend, port `80`

The current branch image tag will be:

```text
deploy-vps
```

GitHub/GHCR converts the branch name `deploy/vps` into the Docker-safe tag `deploy-vps`.

## 1. Create A GitHub Repository

In GitHub:

1. Go to `https://github.com/new`.
2. Create an empty repository.
3. Do not initialize it with a README, license, or `.gitignore`.
4. Copy the repository URL.

Example:

```text
https://github.com/YOUR_USERNAME/doctor.com.git
```

## 2. Push This Current Branch

From the repo root:

```bash
git status
git add .
git commit -m "chore: add ghcr dokploy deployment"
git remote add origin https://github.com/YOUR_USERNAME/doctor.com.git
git push -u origin deploy/vps
```

If `origin` already exists, use:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/doctor.com.git
git push -u origin deploy/vps
```

## 3. Enable GitHub Actions Package Publishing

The workflow at `.github/workflows/ghcr-publish.yml` publishes images to GHCR.

In GitHub:

1. Open your repository.
2. Go to `Settings`.
3. Go to `Actions` -> `General`.
4. Under `Workflow permissions`, select `Read and write permissions`.
5. Save.

This lets `GITHUB_TOKEN` push packages to GHCR.

## 4. Run The GHCR Publish Workflow

After pushing `deploy/vps`, open:

```text
GitHub repo -> Actions -> Publish GHCR Images
```

The workflow should run automatically after the push.

When it succeeds, GHCR will contain:

```text
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-server:deploy-vps
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-web:deploy-vps
```

There will also be commit SHA tags.

## 5. Make GHCR Images Pullable By Dokploy

You have two choices.

Public package:

1. Go to your GitHub profile or organization.
2. Open `Packages`.
3. Open `doctor-com-server`.
4. Go to `Package settings`.
5. Change visibility to public.
6. Repeat for `doctor-com-web`.

Private package:

1. Go to GitHub `Settings` -> `Developer settings`.
2. Open `Personal access tokens`.
3. Create a classic token with `read:packages`.
4. In Dokploy, add a registry:

```text
Registry: ghcr.io
Username: YOUR_GITHUB_USERNAME
Password: YOUR_GITHUB_PAT
```

Private is fine. Dokploy just needs a token that can pull GHCR packages.

## 6. Create The API App In Dokploy

In Dokploy, create a new application from Docker image.

Image:

```text
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-server:deploy-vps
```

Port:

```text
3000
```

Suggested domain:

```text
https://api.your-domain.com
```

Set these environment variables:

```env
NODE_ENV=production
PORT=3000

DATABASE_URL=postgresql://USER:PASSWORD@MAIN_POSTGRES_HOST:5432/doctor_com
MEDICATIONS_DATABASE_URL=postgresql://USER:PASSWORD@MEDICATIONS_POSTGRES_HOST:5432/doctor_com_medicaments

BETTER_AUTH_SECRET=replace-with-a-random-secret-at-least-32-characters
BETTER_AUTH_URL=https://api.your-domain.com
CORS_ORIGIN=https://app.your-domain.com

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

- `DATABASE_URL` is your main app database.
- `MEDICATIONS_DATABASE_URL` is your medication catalog database.
- `MINIO_ENDPOINT` should be the internal Dokploy hostname for MinIO if the services share a network.
- Do not include `http://` in `MINIO_ENDPOINT`; use only the hostname.
- The server image runs both Drizzle migrations before starting.

## 7. Create The Web App In Dokploy

Create a second Dokploy application from Docker image.

Image:

```text
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-web:deploy-vps
```

Port:

```text
80
```

Suggested domain:

```text
https://app.your-domain.com
```

Set this environment variable:

```env
APP_SERVER_URL=https://api.your-domain.com
```

The web image reads `APP_SERVER_URL` when the container starts, so the same GHCR image can be reused across domains.

## 8. Deploy Order

Deploy in this order:

1. Main Postgres instance is running.
2. Medications Postgres instance is running.
3. MinIO is running.
4. Deploy `doctor-com-server`.
5. Check `https://api.your-domain.com/` returns:

```text
server running
```

6. Deploy `doctor-com-web`.
7. Open `https://app.your-domain.com`.

## 9. Common First Deploy Problems

API container exits immediately:

- Check `BETTER_AUTH_SECRET` is at least 32 characters.
- Check all SMTP variables are present.
- Check both Postgres URLs are reachable from the API container.
- Check the target databases already exist.

Frontend loads but API calls fail:

- Check `APP_SERVER_URL` on the web app.
- Check `CORS_ORIGIN` on the API app exactly matches the web domain.
- Check `BETTER_AUTH_URL` exactly matches the API domain.

Uploads fail:

- Check `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ROOT_USER`, and `MINIO_ROOT_PASSWORD`.
- Check the API app can reach MinIO over the Dokploy network.
- Check the MinIO user can create or access `MINIO_BUCKET`.

GHCR pull fails in Dokploy:

- Make both packages public, or add a Dokploy registry login for `ghcr.io`.
- If using private packages, the GitHub token needs `read:packages`.

## 10. Updating The VPS Later

After code changes:

```bash
git add .
git commit -m "your change"
git push origin deploy/vps
```

Wait for `Publish GHCR Images` to finish, then redeploy both Dokploy apps using:

```text
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-server:deploy-vps
ghcr.io/YOUR_GITHUB_OWNER/doctor-com-web:deploy-vps
```
