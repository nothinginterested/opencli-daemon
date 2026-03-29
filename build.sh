#!/bin/sh
set -e

BOX_NAME=$(lzc-cli box default)
IMAGE_NAME="dev.${BOX_NAME}.heiyu.space/opencli-mcp:latest"

echo "==> Building Docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "$(dirname "$0")"

echo "==> Streaming image to box via lzc-cli..."
docker save "${IMAGE_NAME}" | lzc-cli docker load

echo "==> Updating manifest with image: ${IMAGE_NAME}"
# macOS sed needs backup extension, use '' for no backup
sed -i '' "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}|g" ./lzc-manifest.yml 2>/dev/null \
  || sed -i "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}|g" ./lzc-manifest.yml

echo "==> Creating dist dir..."
mkdir -p dist

echo "==> Done. Image: ${IMAGE_NAME}"
