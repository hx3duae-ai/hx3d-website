@echo off
REM HX 3D AI Studio - Windows launcher: double-click this file.
cd /d "%~dp0"
where python >nul 2>nul || (echo Python 3.11+ is not installed. Get it from https://www.python.org/downloads/ ^(tick "Add python.exe to PATH"^) & pause & exit /b 1)
where ffmpeg >nul 2>nul || echo WARNING: FFmpeg not found. Video needs it:  winget install Gyan.FFmpeg
if not exist .venv ( python -m venv .venv )
call .venv\Scripts\activate.bat
python -m pip install -q -r requirements.txt || (echo Install failed - send me the error text above & pause & exit /b 1)
start "" http://localhost:8420
python -m uvicorn hxstudio.server:app --port 8420
pause
