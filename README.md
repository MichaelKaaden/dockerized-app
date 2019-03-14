# How To Dockerize an Angular Application

_I won't explain any Docker concepts here. I'm sure you'll find a tutorial that
suits you._

Dockerizing an Angular app is quite easy. I' wi'll show you how to do that in
this document's first part.

It gets a litte bit more complicated to follow Docker's "Build once, run
anywhere" motto. The document's second part will present a possible solution to
this challenge.

A small extension to this is enough to move the complete build process to a
container. I'll show you a motivation and how to do this in the third part.

For demonstration purposes I created a very basic app that consists of two
components. The first displays a 1, the other shows a 2. I'm using the Angular
router to show either one. The purpose is to proof that routing works, even when
reloading the app. This is a real matter because we're going to use
[nginx](http://nginx.org/) to serve the app, and for reloading to work, we need
a rewriting rule in nginx' configuration.

The app will stay the same for all parts of this document, but only from the
user's perspective. For part II, the app will change slightly to allow to be
configured by Docker.

For every part in this document, there is a directory in this source tree. Every
directory contains the whole application so you can easily diff what changed
between the parts explained in this document.

Without further ado, let's start with the simple case.

## Part I: The Simple Case

To run an Angular app inside a Docker container, you don't have to change any
code in your app. All you've got to do is to add some files and edit them to
match your app's name and the target environment's port the app should listen
to.

Let's create an `nginx` directory and put a `default.conf` file inside:

```nginx
client_max_body_size 0;
server_tokens off;
server_names_hash_bucket_size 64;

server {
  listen 80;
  server_name localhost;

  location / {
    root /usr/share/nginx/html;
    index index.html;

    try_files $uri $uri/ /index.html;
  }
}
```

Create a `Dockerfile`. You'll need to change the `dockerized-app` to your app's
name as well as the `maintainer` line.

```dockerfile
FROM nginx
LABEL maintainer="Michael Kaaden <github@kaaden.net>"
COPY nginx/default.conf /etc/nginx/conf.d
COPY dist/dockerized-app /usr/share/nginx/html
```

These two files are already sufficient to build the Docker image containing your
Angular app.

Too keep the image as small as possible, you should create a `.dockerignore`
file to prevent too many files and directories to be transferred to the Docker
daemon.

```
.dockerignore
.editorconfig
.git
.gitignore
.idea
README.md
angular.json
coverage
e2e
node_modules
package.json
package-lock.json
src
tsconfig.json
tslint.json
yarn.lock
```

If you're like me, you love automating steps you need to repeat over and over
again (and which you will most likely forget if another project draws your
attention).

Here's a `dockerize.sh` script to automate building the image (use `npm` instead
of `yarn`, if necessary):

```bash
#!/bin/bash
yarn --prefer-offline --no-progress
ng build --prod
docker build -t dockerized-app .
```

In preparation for the next script, create a `docker-compose.yml` to simplify
the container instantiation:

```yaml
version: "3"

services:
    web:
        image: dockerized-app
        ports:
            - "8093:80"
```

Finally, add a `redeploy.sh` script to automate (re-)starting the container
(this uses the `docker-compose.yml` file shown above):

```bash
#! /bin/bash
export COMPOSE_HTTP_TIMEOUT=300
docker-compose down --remove-orphans
docker-compose up -d
```

With this in place, it's very simple to build and run the app with Docker:

1. Build the app and the Docker image with `./dockerize.sh`

    Example run:

    ```console
    $ ./dockerize.sh
    yarn install v1.13.0
    [1/4] 🔍  Resolving packages...
    success Already up-to-date.
    ✨  Done in 0.41s.

    Date: 2019-03-09T14:56:24.367Z
    Hash: e6105fbbd24ce43b0f57
    Time: 10178ms
    chunk {0} runtime.a5dd35324ddfd942bef1.js (runtime) 1.41 kB [entry] [rendered]
    chunk {1} es2015-polyfills.358ed1827c991dd2afb0.js (es2015-polyfills) 56.4 kB [initial] [rendered]
    chunk {2} main.e87fb3df99e6b4b142c4.js (main) 239 kB [initial] [rendered]
    chunk {3} polyfills.407a467dedb63cfdd103.js (polyfills) 41 kB [initial] [rendered]
    chunk {4} styles.3ff695c00d717f2d2a11.css (styles) 0 bytes [initial] [rendered]

    Sending build context to Docker daemon  393.7kB
    Step 1/4 : FROM nginx
     ---> 42b4762643dc
    Step 2/4 : LABEL maintainer="Michael Kaaden <github@kaaden.net>"
     ---> Using cache
     ---> ebd7affcf553
    Step 3/4 : COPY nginx/default.conf /etc/nginx/conf.d
     ---> Using cache
     ---> 65b24d481385
    Step 4/4 : COPY dist/dockerized-app /usr/share/nginx/html
     ---> Using cache
     ---> a6f5cd965884
    Successfully built a6f5cd965884
    Successfully tagged dockerized-app:latest
    ```

2. Start the container with `./redeploy.sh`

    Example run:

    ```console
    $ ./redeploy.sh
    Stopping dockerized-app_web_1 ... done
    Removing dockerized-app_web_1 ... done
    Removing network dockerized-app_default
    Creating network "dockerized-app_default" with the default driver
    Creating dockerized-app_web_1 ... done
    ```

3. Visit `http://localhost:8093` (that's the port defined in the
   `docker-compose.yml` file above)

## Part II: Build Once, Run Anywhere

Think of a typical development process that requires the following environments:
Development, testing, staging, and production. In each of these, you will
probably at least need a different base URL pointing to the location where the
backend resides. That's why I take this as an example of a configuration option
to change for each of these environments.

In the first environment, the app needs to run wth `ng serve` and
`ng serve --prod` from your shell. So you need some ability to inject the base
URL into your app without any Docker container running.

In the other environments, Docker needs to overwrite the base URL you need for
development with the one fitting into to the individual environment consisting
of many containers being carefully linked together. You somehow need to inject
the base URL here, too.

One thing should be clear: You don't want to build a new image containing your
Angular app for each of these environments just because you have to set a
different base URL for each one. The tested image is the one and only you want
to deploy in both staging and production. Why? Because even on a managed build
system, things might have changed between the first (tested) and the next build.
For example, a new npm release might have crept in. You might have updated
global packages. Someone might have made a tiny hotfix in your code base. All of
these might result in a image that is slightly different from the one you had
tested thoroughly and, therefore, might be faulty. What you need is a image that
you can easily configure to work in each environment.

First of all, we need some mechanism to load the app configuration at runtime.
If we'd use Angular's `environment.ts` for this purpose, the value would need to
be set at _build time_. That's too early. So, what we need to do is to stow away
the configuration in some file which we'll place in the `assets` folder. This
way, we can easily overwrite the file when building the container from the
image, i. e. at _runtime_. We'll see how to do this in a moment.

Here's the `src/assets/settings.json` file that we'll use (since we haven't got
a backend in this example code, the value doesn't matter):

```json
{
    "baseUrl": "http://localhost:5002"
}
```

Let's define a `Settings` interface that resembles the config file's structure:

```typescript
export interface Settings {
    baseUrl: string;
}
```

Now we need a `SettingsService` that we inject whenever we need to access the
settings.

```typescript
import { Injectable } from "@angular/core";
import { Settings } from "../models/settings";

@Injectable({
    providedIn: "root",
})
export class SettingsService {
    settings: Settings;
}
```

There's one thing we need to cope with when we're retrieving the settings from
the JSON file: The app already needs its settings when it's launching. The
settings are retrieved via an HTTP call, which means it happens asynchronously.
Thankfully, Angular introduced the concept of an `APP_INITIALIZER` for things
like that. I won't go into detail here. The point is: The app waits for the
`APP_INITIALIZER`'s result before continuing to start up, and that's exactly
what we need here.

So, here's the `SettingsInitializerService` that is responsible for loading the
`src/assets/settings.json`:

```typescript
import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Settings } from "../models/settings";
import { SettingsService } from "./settings.service";

@Injectable({
    providedIn: "root",
})
export class SettingsInitializerService {
    constructor(private http: HttpClient, private settings: SettingsService) {}

    initializeSettings(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.http
                .get("assets/settings.json")
                .toPromise()
                .then((response) => {
                    this.settings.settings = response as Settings;
                    resolve();
                })
                .catch((error) => reject(error));
        });
    }
}
```

Finally, as I told you above, the app needs to load the settings during startup.
This is done in the `app.module.ts` file.

```typescript
import { HttpClientModule } from "@angular/common/http";
import { BrowserModule } from "@angular/platform-browser";
import { APP_INITIALIZER, NgModule } from "@angular/core";

import { AppRoutingModule } from "./app-routing.module";
import { AppComponent } from "./components/app/app.component";
import { OneComponent } from "./components/one/one.component";
import { TwoComponent } from "./components/two/two.component";
import { SettingsInitializerService } from "./services/settings-initializer.service";

export function initSettings(
    settingsInitializerService: SettingsInitializerService,
) {
    return () => settingsInitializerService.initializeSettings();
}

@NgModule({
    declarations: [AppComponent, OneComponent, TwoComponent],
    imports: [BrowserModule, AppRoutingModule, HttpClientModule],
    providers: [
        {
            provide: APP_INITIALIZER,
            useFactory: initSettings,
            deps: [SettingsInitializerService],
            multi: true,
        },
    ],
    bootstrap: [AppComponent],
})
export class AppModule {}
```

With this, the development environment is fully functional. Just put the
development's base URL in the `src/assets/settings.json` file.

Well... What's still missing is the explanation how to change the base URL for
each Docker container. The option I like to use to fix this uses the `envsubst`
command. This takes a template file as input and substitutes all known
environment variables with their value.

Here's the `src/assets/settings.json.template` file:

```json
{
    "baseUrl": "${BASE_URL}"
}
```

Our updated `docker-compose.yml` will now use `envsubst` to produce the correct
`src/assets/settings.json` file from this template for each container by
substituting the base URL:

```yaml
version: "3"

services:
    web:
        image: dockerized-app
        env_file:
            - ./docker.env
        ports:
            - "8093:80"
        command:
            /bin/bash -c "envsubst '$$BASE_URL' <
            /usr/share/nginx/html/assets/settings.json.template >
            /usr/share/nginx/html/assets/settings.json && exec nginx -g 'daemon
            off;'"
```

As you can see, I defined the environment inside the `docker.env` file. It looks
like this:

```bash
BASE_URL=http://some.official.server:444
```

With this, we have all the building blocks together to build and run the
container. The scripts shown above still work. But now the base URL from the
`docker.env` file will be set used instead of the one you defined for the
development environment.

## Part III: The Multi-Stage Build

As you probably know, you need some globally installed tools to build an Angular
app. There's at least Node.js, npm (or yarn), @angular/cli and some web browser
for running the unit tests before building the app.

If you're developing different apps in parallel, you'd need to switch between
different versions of the tools. For example, for app A you'd need Node.js in
version 10.15.3, for the older app B you'd need 8.11.1 instead. To build either
app, you'd have to remember to switch to the correct Node.js version before. You
don't want to do that, even with scripts using [n](https://github.com/tj/n) or
[nvm](https://github.com/creationix/nvm) to do that switch during the build.
Really. Just imagine you'd kick off two builds at the same time...

One solution to this problem would be to install a build server like Jenkins.
For every project, you're able to configure an individual Node.js version.
Unfortunately, that only solves half the problem. You'd still have the problem
that you'd have to install some browser globally which perhaps you can't or
don't want.

The alternative is a multi-stage Docker build process. With this, you're
essentially able to cascade two Docker build processes. The first one does the
heavy lifting of building your app with all the dependencies like Node.js and
Chrome installed, the second just copies the result into a new container. Best
thing is that those dependencies are under the developer's control and are part
of the version control -- which the Jenkins configuration isn't. This resembles
the process you run on your development machine, except that you no longer have
to worry about having the right tools and their versions installed because they
are already included in the Docker image.

To try this, we need to change some of the files we prepared in part II.

First of all, we need to shorten our `.dockerignore` file to this one:

```
.editorconfig
.git
.gitignore
.idea
README.md
coverage
dist
node_modules
```

As you can see, we're no longer hiding the files needed for building the app
from the Docker daemon because the first stage will now take care of the build.
On the other hand, we no longer need the `dist` folder for exactly the same
reason.

The next thing we have to change is the `src/karma.conf.js` file. Please add the
following to its `config.set({...})` section:

```
customLaunchers: {
    ChromeHeadlessNoSandbox: {
        base: "ChromeHeadless",
        flags: ["--no-sandbox"],
    },
},
```

At least for Debian GNU/Linux where I do my builds, you'll need this to be able
to run the unit tests successfully.

Of course, we have to update the `Dockerfile`, too:

```dockerfile
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
```

This Dockerfile uses a special image containing a pre-installed Node.js v10.
Then, we're installing `@angular/cli` and the Chromium browser globally. After
that, we're running the unit tests and then building the app. The second stage
just copies the artifacts the first stage generated into a clean nginx image.

Finally, please update the `dockerize.sh` script to the
following:

```bash
#!/bin/bash
docker build -t dockerized-app .
```

Now, we no longer need to build the app with this script as the new multi-stage
build will take care of this.

To build the app and to run the resulting image, you need to call both scripts
in sequence, just like you did before switching to the multi-stage build
process:

```console
$ ./dockerize.sh
Sending build context to Docker daemon  375.3kB
Step 1/14 : FROM node:10-alpine as node
 ---> 94f3c8956482
Step 2/14 : RUN npm install -g @angular/cli
 ---> Using cache
 ---> fa482a783256
Step 3/14 : RUN echo @edge http://nl.alpinelinux.org/alpine/edge/community >> /etc/apk/repositories     && echo @edge http://nl.alpinelinux.org/alpine/edge/main >> /etc/apk/repositories     && apk add --no-cache     chromium@edge     harfbuzz@edge     nss@edge     && rm -rf /var/cache/*
 ---> Using cache
 ---> 5564ed996f5f
Step 4/14 : RUN mkdir -p /usr/src/app     && adduser -D chrome     && chown -R chrome:chrome /usr/src/app
 ---> Using cache
 ---> 4386166be7c2
Step 5/14 : USER chrome
 ---> Using cache
 ---> 7cb58fa5c1a2
Step 6/14 : ENV CHROME_BIN=/usr/bin/chromium-browser     CHROME_PATH=/usr/lib/chromium/
 ---> Using cache
 ---> d6ebad5eb164
Step 7/14 : WORKDIR /usr/src/app
 ---> Using cache
 ---> 13013d263739
Step 8/14 : COPY . ./
 ---> dc4a22077f73
Step 9/14 : RUN yarn
 ---> Running in 6437e5fa60d9
yarn install v1.13.0
[1/4] Resolving packages...
[2/4] Fetching packages...
info fsevents@1.2.7: The platform "linux" is incompatible with this module.
info "fsevents@1.2.7" is an optional dependency and failed compatibility check. Excluding it from installation.
[3/4] Linking dependencies...
[4/4] Building fresh packages...
Done in 42.82s.
Removing intermediate container 6437e5fa60d9
 ---> 90e56dd32b15
Step 10/14 : RUN ng test --watch=false --browsers=ChromeHeadlessNoSandbox && ng build --prod
 ---> Running in d1ddaffc16cb
13 03 2019 21:00:50.648:INFO [karma-server]: Karma v4.0.1 server started at http://0.0.0.0:9876/
13 03 2019 21:00:50.650:INFO [launcher]: Launching browsers ChromeHeadlessNoSandbox with concurrency unlimited
13 03 2019 21:00:50.669:INFO [launcher]: Starting browser ChromeHeadless
13 03 2019 21:00:53.547:INFO [HeadlessChrome 72.0.3626 (Linux 0.0.0)]: Connected on socket 3N6EMwCRhxGyDnspAAAA with id 6433480
HeadlessChrome 72.0.3626 (Linux 0.0.0): Executed 7 of 7 SUCCESS (0.236 secs / 0.224 secs)
TOTAL: 7 SUCCESS
TOTAL: 7 SUCCESS

Date: 2019-03-13T21:01:17.137Z
Hash: b37badaa2a2a81628c08
Time: 18579ms
chunk {0} runtime.a5dd35324ddfd942bef1.js (runtime) 1.41 kB [entry] [rendered]
chunk {1} es2015-polyfills.4a4cfea0ce682043f4e9.js (es2015-polyfills) 56.4 kB [initial] [rendered]
chunk {2} main.93dfc87f5d440cbc16ac.js (main) 262 kB [initial] [rendered]
chunk {3} polyfills.9f3702a215d30daac9b6.js (polyfills) 41 kB [initial] [rendered]
chunk {4} styles.3ff695c00d717f2d2a11.css (styles) 0 bytes [initial] [rendered]
Removing intermediate container d1ddaffc16cb
 ---> 2827acaf8241
Step 11/14 : FROM nginx
 ---> 42b4762643dc
Step 12/14 : LABEL maintainer="Michael Kaaden <github@kaaden.net>"
 ---> Using cache
 ---> e90650758b69
Step 13/14 : COPY nginx/default.conf /etc/nginx/conf.d
 ---> Using cache
 ---> 036bfc0c7c36
Step 14/14 : COPY --from=node /usr/src/app/dist/dockerized-app /usr/share/nginx/html
 ---> 990a8e08cc46
Successfully built 990a8e08cc46
Successfully tagged dockerized-app:latest
```

```console
$ ./redeploy.sh
Removing network dockerized-app_default
WARNING: Network dockerized-app_default not found.
Creating network "dockerized-app_default" with the default driver
Creating dockerized-app_web_1 ... done
```

## Comparison

Regarding their size, there's absolutely no difference between the ways we built the images.

| REPOSITORY                 | TAG     | IMAGE ID      | CREATED              | SIZE  |
|----------------------------|---------|---------------|----------------------|-------|
| dockerized-app-simple      | latest  | a90b35651f39  | 18 minutes ago       | 110MB |
| dockerized-app-env         | latest  | 709da311ce4b  | 17 minutes ago       | 110MB |
| dockerized-app-multistage  | latest  | 3ecfc4231dd5  | About a minute ago   | 110MB |

If you don't need to change the configuration, stick to the simple way described in part I to build your app.
For an app running in different environments, you have to choose either the second or third
way. Furthermore, you need to decide on how often your tools need to change. If you've got
everything under control, you may stick to the second way described in part II. Else, I suggest
to use the multi-stage build I've shown you in part III.

Whichever way you choose, you'll soon see how easy it is to deploy your app using Docker.
