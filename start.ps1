# start.ps1 - Launch both backend and frontend together
Write-Host "Starting Relay Dashboard..." -ForegroundColor Cyan

# Start backend in a new window
Start-Process powershell -ArgumentList '-NoExit', '-Command', @"
  cd '$PSScriptRoot\backend'
  if (-not (Test-Path 'venv')) {
    Write-Host 'Creating Python venv...' -ForegroundColor Yellow
    python -m venv venv
  }
  .\venv\Scripts\Activate.ps1
  pip install -r requirements.txt -q
  if (-not (Test-Path '.env')) {
    Copy-Item .env.example .env
    Write-Host '.env created - please set DATABASE_URL and ANTHROPIC_API_KEY' -ForegroundColor Yellow
  }
  python run.py
"@

Start-Sleep -Seconds 2

# Start frontend in a new window
Start-Process powershell -ArgumentList '-NoExit', '-Command', @"
  cd '$PSScriptRoot\frontend'
  if (-not (Test-Path 'node_modules')) {
    Write-Host 'Installing npm packages...' -ForegroundColor Yellow
    npm install
  }
  npm run dev
"@

Write-Host ""
Write-Host "Backend:  http://localhost:8000" -ForegroundColor Green
Write-Host "Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "To seed demo data, run in the backend window:" -ForegroundColor Yellow
Write-Host "  python seed.py" -ForegroundColor White
