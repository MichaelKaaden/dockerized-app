FROM nginx
LABEL maintainer="Michael Kaaden <github@kaaden.net>"
COPY dist/dockerized-app /usr/share/nginx/html
