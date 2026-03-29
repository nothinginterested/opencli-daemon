#!/bin/sh
set -e

BOX_NAME=$(lzc-cli box default)
IMAGE_NAME="dev.${BOX_NAME}.heiyu.space/opencli-mcp:latest"

echo "==> Building Docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "$(dirname "$0")"

echo "==> Pushing to dev registry..."
docker push "${IMAGE_NAME}"

echo "==> Updating manifest with image: ${IMAGE_NAME}"
sed -i "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}|g" ./lzc-manifest.yml

echo "==> Creating dist dir..."
mkdir -p dist

echo "==> Done. Image: ${IMAGE_NAME}"
