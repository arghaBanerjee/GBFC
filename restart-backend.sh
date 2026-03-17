#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8000
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"

PIDS=$(lsof -ti tcp:${PORT} || true)
if [ -n "$PIDS" ]; then
  echo "Stopping existing backend on port ${PORT}..."
  echo "$PIDS" | xargs kill
  sleep 2
fi

REMAINING_PIDS=$(lsof -ti tcp:${PORT} || true)
if [ -n "$REMAINING_PIDS" ]; then
  echo "Force stopping remaining backend processes on port ${PORT}..."
  echo "$REMAINING_PIDS" | xargs kill -9
fi

for i in {1..10}; do
  if ! lsof -ti tcp:${PORT} >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

if lsof -ti tcp:${PORT} >/dev/null 2>&1; then
  echo "Port ${PORT} is still in use. Please stop the remaining process and try again."
  exit 1
fi

cd "$SCRIPT_DIR"
echo "Starting backend on http://localhost:${PORT} ..."
if [ -x "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" -m uvicorn api:app --reload
else
  python3 -m uvicorn api:app --reload
fi
