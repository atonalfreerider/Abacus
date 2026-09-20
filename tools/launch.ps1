param([switch]$Stop)
$ErrorActionPreference = 'Stop'
try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $candidates = @(
        (Join-Path $projectRoot '.runtime\node.exe'),
        (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'),
        (Join-Path $env:ProgramFiles 'nodejs\node.exe')
    )
    $nodeCommand = Get-Command node.exe -ErrorAction SilentlyContinue
    if ($nodeCommand) { $candidates += $nodeCommand.Source }
    $nodePath = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if (!$nodePath) { throw 'Node.js was not found. Install Node.js 20 or newer, then double-click Start Abacus again.' }
    Push-Location -LiteralPath $projectRoot
    try {
        if ($Stop) { & $nodePath (Join-Path $PSScriptRoot 'launch.mjs') --stop }
        else { & $nodePath (Join-Path $PSScriptRoot 'launch.mjs') }
        if ($LASTEXITCODE -ne 0) { throw 'Abacus could not start. See the message above.' }
    } finally { Pop-Location }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
