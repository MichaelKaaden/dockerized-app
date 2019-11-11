FROM node:10-buster as node

RUN npm install -g @angular/cli@7.3.5

# install Google Chrome
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update && apt-get install -yq google-chrome-stable

# now test and build the app
WORKDIR /usr/src/app
COPY . ./
RUN yarn install
# ChromeHeadless needs to be run with --no-sandbox
RUN ng test --watch=false --browsers=ChromeHeadlessNoSandbox && ng build --prod

# Stage 2
FROM nginx

LABEL maintainer="Michael Kaaden <github@kaaden.net>"

COPY nginx/default.conf /etc/nginx/conf.d
COPY --from=node /usr/src/app/dist/dockerized-app /usr/share/nginx/html
