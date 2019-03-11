# Dockerizing an Angular app

## A Little HowTo

Dockerizing an Angular app isn't difficult.

What is difficult is making the container configurable from `docker-compose`. That's what all the Settings,
SettingsService, and SettingsInitializerService classes are about. The app needs the settings when it's launching, but
the settings are retrieved via an HTTP call, which is asynchronous. Angular introduced the concept of an
`APP_INITIALIZER` for that. I won't go into detail here, please look it up for yourself. It launches the app as soon as
the initializer has resolved, i. e. the settings have been loaded from the `assets/settings.json` file.

### Files To Add

In preparation, add the following files:

-   Create an `nginx` directory and put the following `default.conf` file inside. As you can see, it lets the nginx
    server listen on the internal port 80.

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

-   Add a `Dockerfile`

    ```dockerfile
    FROM nginx
    LABEL maintainer="Michael Kaaden <github@kaaden.net>"
    COPY nginx/default.conf /etc/nginx/conf.d
    COPY dist/dockerized-app /usr/share/nginx/html
    ```

-   Add a `.dockerignore` file to prevent too many files and directories to be added to your image

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

-   Add a `dockerize.sh` script to automate building the image

    ```bash
    #!/bin/bash
    yarn --prefer-offline --no-progress
    ng build --prod
    docker build -t dockerized-app .
    ```

-   Add a `docker.env` file containing all the substitutions that have to be done for the container (in this example, it
    only sets the BASE_URL for the non-existent backend service):

    ```bash
    BASE_URL=http://some.official.server:444
    ```

-   Add a `docker-compose.yml` to pack all Docker configuration stuff inside. In this example, the host's port 8093 will
    be mapped to the container's internal port 80.

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
                /bin/bash -c "envsubst '$$BASE_URL' < /usr/share/nginx/html/assets/settings.json.template >
                /usr/share/nginx/html/assets/settings.json && exec nginx -g 'daemon off;'"
    ```

-   Add a `redeploy.sh` script to automate (re-)starting the container

    ```bash
    #! /bin/bash
    export COMPOSE_HTTP_TIMEOUT=300
    docker-compose down --remove-orphans
    docker-compose up -d
    ```

### Building And Running The Dockerized App

Now it's very easy to build and run the app with Docker:

1. Build the app and the image with `./dockerize.sh`

    Example run:

    ```
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

    ```
    $ ./redeploy.sh
    Stopping dockerized-app_web_1 ... done
    Removing dockerized-app_web_1 ... done
    Removing network dockerized-app_default
    Creating network "dockerized-app_default" with the default driver
    Creating dockerized-app_web_1 ... done
    ```

3. Visit `http://localhost:8093` (that's the port defined in the `docker-compose.yml` file)

## Generic @angular/cli README.md contents

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 7.3.5.

## Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The app will automatically reload if you change
any of the source files.

## Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use
`ng generate directive|pipe|service|class|guard|interface|enum|module`.

## Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory. Use the `--prod` flag
for a production build.

## Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via [Protractor](http://www.protractortest.org/).

## Further help

To get more help on the Angular CLI use `ng help` or go check out the
[Angular CLI README](https://github.com/angular/angular-cli/blob/master/README.md).
