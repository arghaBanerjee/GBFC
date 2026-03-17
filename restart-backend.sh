#!/bin/zsh
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PORT=8000
PYTHON_BIN="$SCRIPT_DIR/venv/bin/python"

PIDS=$(lsof -ti tcp:${PORT} || true)
if [ -n "$PIDS" ]; then
  echo "Stopping existing backend on port ${PORT}..."
  echo "$PIDS" | xargs kill
  sleep 1
fi

cd "$SCRIPT_DIR"
echo "Starting backend on http://localhost:${PORT} ..."
if [ -x "$PYTHON_BIN" ]; then
  "$PYTHON_BIN" -m uvicorn api:app --reload
else
  python3 -m uvicorn api:app --reload
fi
