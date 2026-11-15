#!/bin/bash
# Double-click to start the SAT Math Trainer.
cd "$(dirname "$0")" || exit 1

URL="http://127.0.0.1:8899"

if curl -s --max-time 2 "$URL/api/health" >/dev/null 2>&1; then
  echo "Already running — opening $URL"
  open "$URL"
  exit 0
fi

echo "Starting SAT Math Trainer…"
node server.mjs &
SERVER_PID=$!
sleep 1.5

if ! curl -s --max-time 3 "$URL/api/health" >/dev/null 2>&1; then
  echo
  echo "Could not start the server. Is node installed?  (node -v)"
  exit 1
fi

open "$URL"
echo
echo "  Running at $URL"
echo "  Leave this window open while you study. Press Ctrl-C to stop."
echo
wait $SERVER_PID
