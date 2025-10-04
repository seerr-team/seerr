FROM node:22-alpine AS build_image

ARG SOURCE_DATE_EPOCH
ARG TARGETPLATFORM
ARG COMMIT_TAG
ENV TARGETPLATFORM=${TARGETPLATFORM:-linux/amd64}
ENV COMMIT_TAG=${COMMIT_TAG}

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

RUN \
  case "${TARGETPLATFORM}" in \
  'linux/arm64' | 'linux/arm/v7') \
  apk update && \
  apk add --no-cache python3 make g++ gcc libc6-compat bash && \
  npm install --global node-gyp \
  ;; \
  esac

WORKDIR /app

COPY package.json pnpm-lock.yaml postinstall-win.js ./
RUN CYPRESS_INSTALL_BINARY=0 pnpm install --frozen-lockfile

COPY . ./
RUN pnpm build

# remove development dependencies
RUN pnpm prune --prod --ignore-scripts && \
  rm -rf src server .next/cache charts gen-docs docs && \
  touch config/DOCKER && \
  echo "{\"commitTag\": \"${COMMIT_TAG}\"}" > committag.json

FROM node:22-alpine

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

RUN apk add --no-cache tzdata tini && rm -rf /tmp/*

# copy from build image
COPY --from=build_image /app ./

ENTRYPOINT [ "/sbin/tini", "--" ]
CMD [ "pnpm", "start" ]

EXPOSE 5055
