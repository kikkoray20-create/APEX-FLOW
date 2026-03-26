#!/usr/bin/env bash

# Abort on errors
set -e

# Build
echo "Building..."
npm run build

# Navigate into the build output directory
cd dist

# If you are deploying to a custom domain
# echo 'www.example.com' > CNAME

git init
git checkout -b main
git add -A
git commit -m 'deploy'

# If you are deploying to https://<USERNAME>.github.io
# git push -f git@github.com:<USERNAME>/<USERNAME>.github.io.git main

# If you are deploying to https://<USERNAME>.github.io/<REPO>
# git push -f git@github.com:<USERNAME>/<REPO>.github.io.git main:gh-pages

cd -
