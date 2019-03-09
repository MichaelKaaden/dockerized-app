#!/bin/bash
yarn --prefer-offline --no-progress
yarn prod
docker build -t dockerized-app .
