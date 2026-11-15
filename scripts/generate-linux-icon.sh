#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_SOURCE="$ROOT_DIR/src-tauri/icons/outbreak-zones.svg"
ICON_OUTPUT="$ROOT_DIR/src-tauri/icons/outbreak-zones.png"

if ! command -v rsvg-convert >/dev/null 2>&1; then
  echo "Erro: rsvg-convert não encontrado. Instale o pacote librsvg." >&2
  exit 1
fi

rsvg-convert --width 512 --height 512 "$ICON_SOURCE" --output "$ICON_OUTPUT"
test -s "$ICON_OUTPUT"
echo "Ícone Linux gerado: $ICON_OUTPUT"
