@echo off
echo 📡 Starting Clipboard Monitor...
cd /d "%~dp0desktop"
python clipboard_monitor.py
pause