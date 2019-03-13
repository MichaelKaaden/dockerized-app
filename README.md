# Dockerizing an Angular app

Dockerizing an Angular app is quite easy. I will show you how to do that in this
document's first part.

It gets a litte bit more complicated to follow Docker's "Build once, run
anywhere" motto. The document's second part will show you a possible solution to
this challenge.

I won't explain any Docker concepts here. I'm sure you'll easily be able to find
a documentation or tutorial fitting your needs.

## Part I: The Simple Case

To run an Angular app inside a Docker container without further configuration
from the outside, you don't have to change any code in your app. All you've got
to do is to add some files and edit them to match your app's name and the target
environment's port the app should listen to.

[Here](https://github.com/MichaelKaaden/dockerized-app/releases/tag/0.0.2) you
can find the sources that are included in this part of the document.

### Files To Add

Add the following two files:

-   Create an `nginx` directory and put a `default.conf` file inside:

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

-   Create a `Dockerfile`

    ```dockerfile
    FROM nginx
    LABEL maintainer="Michael Kaaden <github@kaaden.net>"
    COPY nginx/default.conf /etc/nginx/conf.d
    COPY dist/dockerized-app /usr/share/nginx/html
    ```

These two files are sufficient to build the Docker image containing your Angular
app.

Too keep the image as small as possible, you should create a `.dockerignore`
file to prevent too many files and directories to be added to your image

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

If you're like me, you love automating steps you need to repeat often (and which
you will most likely forget if another project draws your attention). Because of
this, I'm using the following two scripts:

-   A `dockerize.sh` script to automate building the image (use `npm` instead of
    `yarn`, if necessary):

    ```bash
    #!/bin/bash
    yarn --prefer-offline --no-progress
    ng build --prod
    docker build -t dockerized-app .
    ```

-   A `docker-compose.yml` to simplify the container instantiation:

    ```yaml
    version: "3"

    services:
        web:
            image: dockerized-app
            ports:
                - "8093:80"
    ```

-   A `redeploy.sh` script to automate (re-)starting the container (this uses
    the `docker-compose.yml` file shown above):

    ```bash
    #! /bin/bash
    export COMPOSE_HTTP_TIMEOUT=300
    docker-compose down --remove-orphans
    docker-compose up -d
    ```

### Building And Running The Dockerized App

Now it's very easy to build and run the app with Docker:

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
   `docker-compose.yml` file)

## Part II: Build Once, Run Anywhere

[Here](https://github.com/MichaelKaaden/dockerized-app/releases/tag/1.0.1) you
can find the sources that are included in this part of the document.

Think of a typical development process that requires the following environments:
Development, testing, staging, and production. In each of these, you will
probably at least need a different base URL pointing to the location where the
backend resides.

In the first environment, the app needs to run wth `ng serve` and
`ng serve --prod` from your shell. So you need some ability to inject the "base
URL" as I'm going to call it into your app without any Docker container running.

In the other environments, Docker needs to overwrite the base URL you need for
development with the one fitting into to the individual environment consisting
of many containers being carefully linked together. You need to somehow inject
the base URL here, too.

One thing should be clear: You don't want to build a new image containing your
Angular app for each of these environments. The tested image is the one you want
to deploy in staging and production. Why? Because on the build system, things
might have changed between the first and the next build. For example, a new npm
release might have crept in. You might have updated global packages. Someone
might have made a tiny hotfix in your code base. All of these might result in a
slightly different build that is different from the one you had tested
thoroughly.

What you need is a configurable image that works in every environment. We'll
concentrate on the base URL. All other configurations should work the same way.

First of all, we need some mechanism to load the app configuration at runtime.
If we'd use Angular's `environment.ts` for this purpose, the value would need to
be set at _build time_. That's too early. So, what we need to do is put the
configuration in some file which we'll place in the `assets` folder. This way,
we can easily overwrite the file when composing the container, i. e. at
_runtime_. We'll see how to do this in a moment.

Here's the `src/assets/settings.json` file that we'll use:

```json
{
    "baseUrl": "http://localhost:5002"
}
```

Let's define a `Settings` interface that defines the config file's structure:

```typescript
export interface Settings {
    baseUrl: string;
}
```

Now we need a `SettingsService` that we simply inject whenever we need to access
the settings.

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
the JSON file: The app already needs its settings when it's launching, but the
settings are retrieved via an HTTP call, which is done asynchronously.
Thankfully, Angular introduced the concept of an `APP_INITIALIZER` for that. I
won't go into detail here. The point is: The app awaits the `APP_INITIALIZER`'s
result before continuing to initialize, and that's exactly what we need here.

So, here's the `SettingsInitializerService` that is responsible for loading the
`Settings`:

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

Finally, the app needs to load the settings during startup. This is done in the
`app.module.ts` file.

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

Now, the app will load the `Settings` during startup.

Well... What's still missing is the possibility to change the base URL for each
Docker container. Currently, every container would use the value set in the
`src/assets/settings.json` file.

One option to fix this is to use the `envsubst` command. This takes a template
file as input and substitutes all known environment variables with their value.

Here's the `src/assets/settings.json.template` file:

```json
{
    "baseUrl": "${BASE_URL}"
}
```

Our updated `docker-compose.yml` will now use `envsubst` to produce the correct
`src/assets/settings.json` file for each container by substituting the base URL:

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

To build and run the container, you still can use the scripts shown above. But
now the base URL will be set to the one defined in the environment.

## Part III: The Multi-Stage Build

[Here](https://github.com/MichaelKaaden/dockerized-app) you can find the sources
that are included in this part of the document.

As you probably know, you need some globally installed software to build an
Angular app. There's at least Node.js, npm (or yarn), and some web browser for
running the unit tests.

If you're developing different apps in parallel, you'd need to switch between
different versions of the software. For app A you'd need Node.js in version
10.15.3, for the older App B you'd need 8.11.1 instead. To build either app,
you'd have to install the correct Node.js version before. You don't want to do
that. Really.

One solution to this problem would be to install a build server like Jenkins.
For every project, you're able to configure an individual Node.js version. But
you still have the problem that you'd have to install some browser globally.

The alternative would be a multi-stage Docker build. With this method you're
able to cascade two Docker build processes. The first one does the heavy lifting
of building your app with all the dependencies like Node.js and Chrome
installed, the second just copies the result into a new container. This is more
or less the process you ran on your development machine, except that you no
longer have to worry about having the right tools and their versions installed
because they are already included in the Docker image.

To try this, we need to change some things.

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

As you can see, we're no longer stripping the sources from the Docker build.
That's because we need to include them for the first stage to build and test the
app. On the other hand, we no longer need the `dist` folder as we're going to
build the app during the Docker build's first stage.

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

At least for Debian GNU/Linux, you'll need this to be able to run the unit tests
successfully.

Of course, we have to change the `Dockerfile`, too. To keep the previous one so
we're still able to do a simple build instead of the multi-stage one, please add
a new one named `Dockerfile.multi-stage`:

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

Finally, please create a new `dockerize.multi-stage.sh` script and put the
following in:

```bash
#!/bin/bash
docker build -f Dockerfile.multi-stage -t dockerized-app .
```

Now, we no longer need to build the app with this script as the new multi-stage
build will take care of this.

To build the app and to run the resulting image, you need to call both scripts
in sequence, just like you did before switching to the multi-stage build
process:

```console
$ ./dockerize.multi-stage.sh
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

The only thing left is to decide whether you want to use the simple or the
multi-stage build.
