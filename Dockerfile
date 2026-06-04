FROM node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f AS base
ARG SOURCE_DATE_EPOCH
ARG TARGETPLATFORM
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . ./app
WORKDIR /app

FROM base AS prod-deps

RUN --mount=type=cache,id=pnpm,target=/pnpm/store CI=true pnpm install --prod --frozen-lockfile

# Remove large native modules for linux-x64-gnu platform (we use alpine which is musl-based)
# not supported in pnpm for now due to this bug: https://github.com/pnpm/pnpm/issues/9654
RUN du -shL ./node_modules/.pnpm/* | grep '[0-9]M.*' | grep 'linux-x64-gnu@' | awk '{print $2}' | xargs rm -rf
# Remove large module files not needed for production
RUN if [ -d node_modules/.pnpm ]; then \
  find node_modules/.pnpm -type d \( \
  -path "*ace-builds/src-noconflict" -o \
  -path "*ace-builds/src" -o \
  -path "*ace-builds/src-min" -o \
  -path "*country-flag-icons/react" -o \
  -path "*country-flag-icons/string" -o \
  -path "*country-flag-icons/1x1" -o \
  -path "*@heroicons/react/16" \
  \) -exec rm -rf {} + || true; \
  fi

FROM base AS build

ARG COMMIT_TAG
ENV COMMIT_TAG=${COMMIT_TAG}

RUN \
  case "${TARGETPLATFORM}" in \
  'linux/arm64' | 'linux/arm/v7') \
  apk update && \
  apk add --no-cache python3 make g++ gcc libc6-compat bash && \
  npm install --global node-gyp \
  ;; \
  esac

RUN --mount=type=cache,id=pnpm,target=/pnpm/store CYPRESS_INSTALL_BINARY=0 pnpm install --frozen-lockfile

RUN pnpm build

RUN rm -rf .next/cache

FROM node:22.22.2-alpine3.23@sha256:8ea2348b068a9544dae7317b4f3aafcdc032df1647bb7d768a05a5cad1a7683f
ARG SOURCE_DATE_EPOCH
ARG COMMIT_TAG
ENV NODE_ENV=production
ENV COMMIT_TAG=${COMMIT_TAG}

RUN apk add --no-cache tzdata

USER node:node

WORKDIR /app

COPY --chown=node:node . .
COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/dist ./dist

RUN touch config/DOCKER && \
  echo "{\"commitTag\": \"${COMMIT_TAG}\"}" > committag.json

EXPOSE 5055

CMD [ "npm", "start" ]
