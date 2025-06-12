@echo off
echo 🎉 Starting ClipVersion System...
echo.
echo Starting backend server...
start "Backend" cmd /k "%~dp0start_backend.bat"

timeout /t 3 /nobreak > nul

echo Starting clipboard monitor...
start "Monitor" cmd /k "%~dp0start_monitor.bat"

timeout /t 2 /nobreak > nul

echo Starting key mapper...
start "KeyMapper" cmd /k "%~dp0start_keymapper.bat"

echo.
echo ✅ All components started!
echo 🌐 Open frontend\index.html in your browser
pause