#!/bin/bash
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
kit_dir="$(cd -- "$(dirname -- "$0")" && pwd)" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install Node.js LTS from https://nodejs.org/ then open this file again.'
  read -r _
  exit 1
fi
node "$kit_dir/studio.cjs" "$kit_dir/.."
album_exit=$?
printf '\nPress Enter to close: '
read -r _
exit "$album_exit"
