#!/bin/sh
set -e

BOX_NAME=$(lzc-cli box default)
IMAGE_NAME="dev.${BOX_NAME}.heiyu.space/opencli-mcp:latest"
TAR_FILE="/tmp/opencli-mcp.tar"

echo "==> Building Docker image: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" "$(dirname "$0")"

echo "==> Saving image to tar..."
docker save "${IMAGE_NAME}" -o "${TAR_FILE}"

echo "==> Loading image onto box via lzc-cli..."
lzc-cli docker load -i "${TAR_FILE}"

echo "==> Cleaning up tar..."
rm -f "${TAR_FILE}"

echo "==> Updating manifest with image: ${IMAGE_NAME}"
# macOS sed needs backup extension, use '' for no backup
sed -i '' "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}|g" ./lzc-manifest.yml 2>/dev/null \
  || sed -i "s|IMAGE_PLACEHOLDER|${IMAGE_NAME}|g" ./lzc-manifest.yml

echo "==> Creating dist dir..."
mkdir -p dist

echo "==> Done. Image: ${IMAGE_NAME}"
