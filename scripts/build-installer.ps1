# Costruisce installer e zip (npm run make) da una COPIA del progetto in un percorso senza caratteri speciali.
# Serve perche lo strumento di Squirrel che inserisce l'icona nell'installer non legge percorsi con emoji
# o altri caratteri non ASCII (la cartella "Personali" contiene un'emoji). Alla fine i file sono in out\make\.
# Uso: npm run make:win

$ErrorActionPreference = "Stop"

$proj = Split-Path -Parent $PSScriptRoot
$tmp  = Join-Path $env:TEMP "ppbuild"
$dest = Join-Path $proj "out"

Write-Host "Copia del progetto in $tmp ..."
if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }

# node_modules, dist e out si rigenerano nella copia; .git e .claude non servono
robocopy $proj $tmp /E /XD node_modules out dist .git .claude /NFL /NDL /NJH /NJS | Out-Null
# robocopy: i codici da 0 a 7 vanno bene (file copiati), da 8 in su sono errori
if ($LASTEXITCODE -ge 8) { throw "Copia fallita (robocopy codice $LASTEXITCODE)" }

Push-Location $tmp
try {
    Write-Host "Installazione delle dipendenze (npm ci) ..."
    npm ci
    if ($LASTEXITCODE -ne 0) { throw "npm ci fallito" }

    Write-Host "Creazione di installer e zip (npm run make) ..."
    npm run make
    if ($LASTEXITCODE -ne 0) { throw "npm run make fallito" }
}
finally {
    Pop-Location
}

Write-Host "Copia dei file finiti in $dest\make ..."
if (Test-Path $dest) { Remove-Item -Recurse -Force $dest }
New-Item -ItemType Directory -Path $dest | Out-Null
Copy-Item -Recurse -Force (Join-Path $tmp "out\make") (Join-Path $dest "make")

Remove-Item -Recurse -Force $tmp

Write-Host ""
Write-Host "Fatto. File in:"
Get-ChildItem (Join-Path $dest "make") -Recurse -File | ForEach-Object {
    Write-Host ("  {0,7:N1} MB  {1}" -f ($_.Length / 1MB), $_.FullName.Substring($proj.Length + 1))
}
