#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-9222}"
MODE="${2:-main}"
TARGET_URL="${3:-https://www.youtube.com}"

find_chrome() {
  for bin in google-chrome-stable google-chrome chromium chromium-browser chrome; do
    if command -v "$bin" >/dev/null 2>&1; then
      echo "$bin"
      return 0
    fi
  done
  return 1
}

CHROME_BIN="$(find_chrome || true)"
if [[ -z "$CHROME_BIN" ]]; then
  echo "[error] Chrome/Chromium binary was not found in PATH." >&2
  echo "Install google-chrome or chromium and try again." >&2
  exit 1
fi

MAIN_PROFILE="${CHROME_MAIN_PROFILE:-$HOME/.config/google-chrome}"
FALLBACK_PROFILE="${CHROME_FALLBACK_PROFILE:-$HOME/.cache/wlb-chrome-debug-profile}"
MIRROR_PROFILE="${CHROME_MIRROR_PROFILE:-$HOME/.cache/wlb-chrome-debug-main-mirror}"

sync_profile() {
  local src="$1"
  local dst="$2"

  if [[ ! -d "$src" ]]; then
    echo "[error] Source profile does not exist: $src" >&2
    return 1
  fi

  mkdir -p "$dst"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete \
      --exclude="Singleton*" \
      --exclude="*/LOCK" \
      --exclude="*/lockfile" \
      --exclude="*/Cache/*" \
      --exclude="*/Code Cache/*" \
      --exclude="*/GPUCache/*" \
      --exclude="*/Service Worker/CacheStorage/*" \
      --exclude="*/Service Worker/ScriptCache/*" \
      "$src/" "$dst/"
  else
    rm -rf "$dst"
    mkdir -p "$dst"
    cp -a "$src/." "$dst/"
    find "$dst" -type f \( -name "Singleton*" -o -name "LOCK" -o -name "lockfile" \) -delete 2>/dev/null || true
  fi
}

if [[ "$MODE" == "main" ]]; then
  USER_DATA_DIR="$MIRROR_PROFILE"
  echo "[info] Syncing main profile into debug mirror."
  echo "[info] source: $MAIN_PROFILE"
  echo "[info] mirror: $USER_DATA_DIR"
  echo "[info] Close all regular Chrome windows for a clean sync."
  sync_profile "$MAIN_PROFILE" "$USER_DATA_DIR"
else
  USER_DATA_DIR="$FALLBACK_PROFILE"
  mkdir -p "$USER_DATA_DIR"
  echo "[info] Using isolated profile: $USER_DATA_DIR"
fi

exec "$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$USER_DATA_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "$TARGET_URL"
