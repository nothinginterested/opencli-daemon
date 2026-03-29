#!/bin/sh
# Generate a simple placeholder icon using Node.js (no extra deps)
node -e "
// Minimal 64x64 PNG (solid #4A90D9 blue)
const { createCanvas } = require('canvas');
" 2>/dev/null || true

# If ImageMagick available:
if command -v convert >/dev/null 2>&1; then
  convert -size 200x200 xc:'#4A90D9' \
    -fill white -gravity center \
    -font DejaVu-Sans-Bold -pointsize 48 \
    -annotate 0 'CLI' \
    lzc-icon.png
  echo "Icon generated with ImageMagick"
else
  echo "Please provide a lzc-icon.png (200x200 square PNG, max 200KB)"
fi
