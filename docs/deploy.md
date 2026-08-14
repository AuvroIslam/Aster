# Deploying Aster

Two halves, deployed separately, because they need different things:

| Half | Host | Why there |
|---|---|---|
| Next.js app | Vercel | Static/SSR, no binaries, no long jobs |
| Express API | Azure App Service (Linux container) | Needs yt-dlp, ffmpeg, a writable cache, and runs that take minutes |

The API cannot go to Vercel: a description run is minutes long and shells out to
two binaries, neither of which a serverless function has.

## What is live

| Piece | Value |
|---|---|
| Frontend | https://aster-coral.vercel.app |
| API | https://aster-api-2026.azurewebsites.net |
| Resource group | `aster-rg` (southeastasia) |
| Registry | `asteracr9692.azurecr.io`, image `aster-api` |
| Plan | `aster-plan`, Linux B1, Always On |
| Subscription | Azure for Students |

## Egress: the proxy, not the laptop

Iris (the previous project) gave its VM a residential exit by running a reverse
SSH SOCKS tunnel from a laptop — `tunnel.ps1`, which had to stay logged in for
the deployment to work. Aster does not do that. It uses **Proxyma**, a
residential proxy service, set as `YTDLP_PROXY`, so nothing depends on a machine
at home being awake.

The reason either is needed at all is unchanged: YouTube's bot-check keys on the
**IP**, not the session, so a datacenter address gets refused no matter how many
cookies are supplied. Measured from inside the container, the proxy answers this
completely — no cookies are configured and none are needed.

What the proxy does *not* fix is per-request flakiness: roughly one exit IP in
four returns 403 for a signed format URL. `server/src/services/youtube.js`
already retries six times with a fresh IP each round, which is why a single 403
in a run is normal and not a failure. A local run through the container showed
exactly this — attempt 1 refused, attempt 2 downloaded 11.3 MB.

## Redeploying the API

```bash
az acr login -n asteracr9692
docker build -t asteracr9692.azurecr.io/aster-api:vN -f Dockerfile .
docker push asteracr9692.azurecr.io/aster-api:vN
az webapp config container set -g aster-rg -n aster-api-2026 \
  --container-image-name asteracr9692.azurecr.io/aster-api:vN
az webapp restart -g aster-rg -n aster-api-2026
```

Two things about this that cost time once and should not again:

- **ACR Tasks (`az acr build`) is blocked on Azure for Students.** The build has
  to happen locally and be pushed. That makes image size a deploy-time cost paid
  over a home uplink, which is why the Dockerfile installs only the server
  workspace (`npm ci --workspace server`, saving 730 MB of Next/React the API
  never runs) and copies two static ffmpeg binaries instead of installing
  Debian's ffmpeg (saving a further 270 MB of X11 and codec libraries).
- **A push over a home connection will drop.** Retry it; Docker skips the layers
  that already landed, so each attempt resumes rather than restarts.

## Redeploying the frontend

```bash
vercel deploy --prod
```

Environment variables live in the Vercel project, not in the repo:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE` | `https://aster-api-2026.azurewebsites.net` |
| `NEXT_PUBLIC_SITE_URL` | `https://aster-coral.vercel.app` |

Both are build-time (`NEXT_PUBLIC_`), so changing either needs a redeploy, not
just a restart.

## The cache, and why the first visitor is not kept waiting

A container filesystem is discarded on restart, so the cache lives on App
Service's persistent `/home` mount:

- `WEBSITES_ENABLE_APP_SERVICE_STORAGE=true`
- `CACHE_DIR=/home/cache`

That mount starts empty, which would leave the first visitor waiting minutes for
a lesson the image already contains. So the described lessons are baked into the
image at `/app/seed-cache` and `server/src/lib/seed.js` copies them across on
boot — but **only when the live cache holds no timelines yet**, so lessons
processed by a learner later are never overwritten. Six lessons ship this way.

## Configuration on Azure

App settings mirror `.env`, minus anything the API does not read. Set or change
one with:

```bash
az webapp config appsettings set -g aster-rg -n aster-api-2026 --settings KEY=value
```

`CORS_ORIGIN` is the one that breaks the frontend if it drifts: it is a
comma-separated allowlist and must contain the Vercel origin exactly. It is
currently both `https://aster-coral.vercel.app` and the longer
`aster-oitijya-islam-auvros-projects-ffacafa9.vercel.app` alias. Preview
deployments get generated hostnames that are **not** in that list and will fail
CORS against production — add one explicitly if a preview needs to reach the API.
