@echo off
echo ⌨️ Starting Key Mapper (F6-F9 hotkeys)...
echo ⚠️ This may require administrator privileges
cd /d "%~dp0desktop"
python key_mapper.py start
pause