#!/usr/bin/env bash
# Start HX 3D AI Studio on http://localhost:8420
cd "$(dirname "$0")" && exec python3 -m uvicorn hxstudio.server:app --host 0.0.0.0 --port "${PORT:-8420}"
