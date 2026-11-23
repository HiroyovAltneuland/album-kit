#!/bin/bash
# Finder may not inherit the terminal's PATH.
export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin"
kit_dir="$(cd -- "$(dirname -- "$0")" && pwd)" || exit 1
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Node.js is required to create an album.' 'Install the LTS version from https://nodejs.org/ and try again.' 'Existing albums can be opened with index.html without Node.js.'
  printf '\nPress Enter to close: '
  read -r _
  exit 1
fi
node "$kit_dir/create.cjs" --interactive
album_exit=$?
printf '\nPress Enter to close: '
read -r _
exit "$album_exit"
