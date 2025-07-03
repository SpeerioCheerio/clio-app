@echo off
echo ⌨️ Starting Key Mapper (F5-F8 hotkeys)...
echo ⚠️ This may require administrator privileges
cd /d "%~dp0desktop"
python key_mapper.py start
pause