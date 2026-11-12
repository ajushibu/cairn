#!/bin/bash
# Render the Murder composition in 30-frame chunks (fresh browser per chunk),
# skipping chunks already on disk. Usage: render_chunks.sh [Composition] [frames-dir-name]
cd "$(dirname "$0")/../film" || exit 1
COMP=${1:-Murder}
OUT=../out/${2:-hand_frames}
mkdir -p "$OUT"
CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
for a in $(seq 0 30 180); do
  b=$((a + 29))
  if [ -f "$OUT/done_$a" ]; then echo "chunk $a-$b already done"; continue; fi
  for try in 1 2 3; do
    npx remotion render src/index.ts $COMP "$OUT/c$a" --sequence --image-format=png --frames=$a-$b \
      --concurrency=2 --timeout=240000 --browser-executable=$CHROME --log=error && { touch "$OUT/done_$a"; echo "chunk $a-$b ok"; break; }
    echo "chunk $a-$b failed (try $try)"
  done
done
ls $OUT/done_* | wc -l
