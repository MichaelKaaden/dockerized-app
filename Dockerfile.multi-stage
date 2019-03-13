FROM node:10-alpine as node

RUN npm install -g @angular/cli

# Installs latest Chromium package.
RUN echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories \
    && echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories \
    && apk add --no-cache \
    chromium@edge \
    harfbuzz@edge \
    nss@edge \
    && rm -rf /var/cache/*

# Add Chrome as a user
RUN mkdir -p /usr/src/app \
    && adduser -D chrome \
    && chown -R chrome:chrome /usr/src/app

# Run Chrome as non-privileged
USER chrome

ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/

WORKDIR /usr/src/app
COPY . ./
RUN yarn
# ChromeHeadless needs to be run with --no-sandbox
RUN ng test --watch=false --browsers=ChromeHeadlessNoSandbox && ng build --prod

# Stage 2
FROM nginx

LABEL maintainer="Michael Kaaden <github@kaaden.net>"

COPY nginx/default.conf /etc/nginx/conf.d
COPY --from=node /usr/src/app/dist/dockerized-app /usr/share/nginx/html
