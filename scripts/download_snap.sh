#!/usr/bin/env bash
set -e

DEST="$(dirname "$0")/../data/snap"
mkdir -p "$DEST"

echo "Downloading SNAP Twitter ego-nets..."
curl -L "https://snap.stanford.edu/data/twitter.tar.gz" -o /tmp/twitter.tar.gz

echo "Extracting..."
tar -xzf /tmp/twitter.tar.gz -C /tmp/

# Copy only .edges files (the graph topology we need)
cp /tmp/twitter/*.edges "$DEST/"
rm -f /tmp/twitter.tar.gz

echo "Done. Files in $DEST:"
ls "$DEST"/*.edges | wc -l
echo ".edges files downloaded."
