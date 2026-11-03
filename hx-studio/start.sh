#!/usr/bin/env bash
# macOS / Linux launcher:  ./start.sh
cd "$(dirname "$0")"
command -v ffmpeg >/dev/null || echo "WARNING: FFmpeg not found (video needs it): brew install ffmpeg  |  apt install ffmpeg"
[ -d .venv ] || python3 -m venv .venv
. .venv/bin/activate && python -m pip install -q -r requirements.txt || exit 1
( sleep 3; (open http://localhost:8420 || xdg-open http://localhost:8420) >/dev/null 2>&1 ) &
exec python -m uvicorn hxstudio.server:app --port 8420
