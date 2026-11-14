# run.ps1 — One command to launch the entire Relay Dashboard
# Usage:  .\run.ps1

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition

Write-Host ""
Write-Host "  Relay Dashboard" -ForegroundColor Cyan
Write-Host "  ===============" -ForegroundColor Cyan

# ── 1. Python venv ──────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  [1/4] Setting up Python environment..." -ForegroundColor Yellow
Push-Location "$root\backend"

if (-not (Test-Path "venv")) {
    python -m venv venv
}

$pip = "$root\backend\venv\Scripts\pip.exe"
& $pip install -r requirements.txt --quiet --disable-pip-version-check
Write-Host "        Python packages ready." -ForegroundColor Green

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
}

Pop-Location

# ── 2. Node modules ─────────────────────────────────────────────────────────
Write-Host "  [2/4] Setting up Node environment..." -ForegroundColor Yellow
Push-Location "$root\frontend"

if (-not (Test-Path "node_modules")) {
    npm install --silent
}
Write-Host "        Node packages ready." -ForegroundColor Green

Pop-Location

# ── 3. Backend (new window) ─────────────────────────────────────────────────
Write-Host "  [3/4] Starting backend on :8000 ..." -ForegroundColor Yellow

$backendScript = @"
`$host.UI.RawUI.WindowTitle = 'Relay  Backend  :8000'
Write-Host ' Relay Backend' -ForegroundColor Cyan
Write-Host ' http://localhost:8000/docs  — API docs' -ForegroundColor DarkGray
Write-Host ''
Set-Location '$root\backend'
& '.\venv\Scripts\Activate.ps1'
python seed.py
python run.py
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendScript

# Give the backend a moment to start before the frontend tries to connect
Start-Sleep -Seconds 4

# ── 4. Frontend (new window) ─────────────────────────────────────────────────
Write-Host "  [4/4] Starting frontend on :5173 ..." -ForegroundColor Yellow

$frontendScript = @"
`$host.UI.RawUI.WindowTitle = 'Relay  Frontend  :5173'
Write-Host ' Relay Frontend' -ForegroundColor Cyan
Write-Host ' http://localhost:5173' -ForegroundColor DarkGray
Write-Host ''
Set-Location '$root\frontend'
npm run dev
"@

Start-Process powershell -ArgumentList "-NoExit", "-Command", $frontendScript

# ── Open browser ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  Opening browser in 5 seconds..." -ForegroundColor DarkGray
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "  App      ->  http://localhost:5173" -ForegroundColor Green
Write-Host "  API Docs ->  http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "  Demo login:" -ForegroundColor White
Write-Host "    Manager:  manager@relay.com  /  manager123" -ForegroundColor Gray
Write-Host "    Agent:    agent@relay.com    /  agent123" -ForegroundColor Gray
Write-Host ""
