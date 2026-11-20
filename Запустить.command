#!/bin/zsh
cd "${0:A:h}" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
port="${PORT:-4173}"
url="http://127.0.0.1:$port"
if curl -fsS "$url/api/projects" >/dev/null 2>&1; then
  open "$url"
  exit
fi
node server.mjs &
server_pid=$!
trap 'kill "$server_pid" 2>/dev/null' EXIT
trap 'exit 130' INT TERM
for attempt in {1..30}; do
  if curl -fsS "$url/api/projects" >/dev/null 2>&1; then
    open "$url"
    break
  fi
  kill -0 "$server_pid" 2>/dev/null || break
  sleep .2
done
wait "$server_pid"
