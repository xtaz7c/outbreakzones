#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ICON_SOURCE="$ROOT_DIR/public/images/icone_launcher_zumbi_512.png"
ICON_OUTPUT="$ROOT_DIR/src-tauri/icons/outbreak-zones.png"

if [[ ! -s "$ICON_SOURCE" ]]; then
  echo "Erro: ícone do launcher não encontrado: $ICON_SOURCE" >&2
  exit 1
fi

mkdir -p "$(dirname "$ICON_OUTPUT")"
cp "$ICON_SOURCE" "$ICON_OUTPUT"
test -s "$ICON_OUTPUT"
echo "Ícone Linux do launcher aplicado: $ICON_OUTPUT"
