Write-Host "Starting ClipVersion System..." -ForegroundColor Green

# Start backend in new window
Write-Host "Starting backend server..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; python app.py"

# Wait a moment
Start-Sleep -Seconds 3

# Start monitor in new window  
Write-Host "Starting clipboard monitor..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\desktop'; python clipboard_monitor.py"

# Wait a moment
Start-Sleep -Seconds 2

# Start key mapper in new window (as admin)
Write-Host "Starting key mapper..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\desktop'; python key_mapper.py start" -Verb RunAs

Write-Host "All components started!" -ForegroundColor Green
Write-Host "Open frontend\index.html in your browser" -ForegroundColor Cyan