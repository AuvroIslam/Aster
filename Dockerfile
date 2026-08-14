# The Aster API: Express, plus the two binaries the pipeline shells out to.
#
# Only the server is here. The Next.js app deploys to Vercel separately, because
# nothing about it needs this image — and the API cannot go to Vercel, since it
# needs yt-dlp, ffmpeg, a writable cache and runs that take minutes.
# Static ffmpeg/ffprobe, taken as two binaries rather than installed. Debian's
# ffmpeg package drags in ~540MB of X11 and codec libraries for a job that needs
# exactly two executables, and this image is pushed over a home uplink where
# that difference is the difference between a deploy that finishes and one that
# times out.
FROM mwader/static-ffmpeg:7.1 AS ffmpeg

FROM node:22-bookworm-slim

COPY --from=ffmpeg /ffmpeg /ffprobe /usr/local/bin/

# ca-certificates matters: without it every HTTPS call, including the proxy,
# fails with an unhelpful certificate error. curl is the healthcheck.
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
 && rm -rf /var/lib/apt/lists/*

# The standalone build, which bundles its own Python — so nothing here needs a
# system python3. Taken from the latest release rather than pinned: yt-dlp
# breaks whenever YouTube changes, so the newest release is the working one.
RUN curl -fsSL --retry 8 --retry-delay 3 --retry-all-errors \
      https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux \
      -o /usr/local/bin/yt-dlp \
 && chmod +x /usr/local/bin/yt-dlp \
 && yt-dlp --version \
 && ffmpeg -version | head -1

WORKDIR /app

# Dependencies first, so a source edit does not reinstall the world.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
# `--workspace server` and nothing else: the root package.json lists Next and
# React as runtime dependencies, and installing those here costs 730MB for code
# this image never executes. The frontend is Vercel's problem, not the API's.
# Workspace deps still hoist to /app/node_modules, which is on the resolution
# path for server/src/*.js.
RUN npm ci --omit=dev --ignore-scripts --workspace server

COPY server ./server
COPY NetworkPdf.pdf ./

# The described lessons, baked in. They are what make the app work on the first
# request with no network at all — see server/src/lib/seed.js, which copies
# this into the persistent cache only when that cache is still empty.
COPY .cache ./seed-cache

ENV NODE_ENV=production \
    PORT=8080 \
    SEED_CACHE_DIR=/app/seed-cache

EXPOSE 8080

# App Service waits for this before routing traffic.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8080/health || exit 1

CMD ["node", "server/src/index.js"]
