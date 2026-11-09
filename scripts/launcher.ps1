param([ValidateSet('start','stop')][string]$Action = 'start', [switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$candidateList = [System.Collections.Generic.List[object]]::new()
$pyCommand = Get-Command py.exe -ErrorAction SilentlyContinue
if ($pyCommand) { $candidateList.Add(@{ Exe = $pyCommand.Source; Prefix = @('-3') }) }
foreach ($commandName in @('python.exe','python3.exe')) {
    $command = Get-Command $commandName -ErrorAction SilentlyContinue
    if ($command -and $command.Source -notlike '*\WindowsApps\*') {
        $candidateList.Add(@{ Exe = $command.Source; Prefix = @() })
    }
}
$bundledPython = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'
if (Test-Path -LiteralPath $bundledPython) { $candidateList.Add(@{ Exe = $bundledPython; Prefix = @() }) }
$pythonRunner = $null
foreach ($candidate in $candidateList) {
    try {
        $prefix = $candidate.Prefix
        $probe = & $candidate.Exe @prefix -c 'import sys; print(1 if sys.version_info >= (3,9) else 0)' 2>$null
        if ($LASTEXITCODE -eq 0 -and $probe -eq '1') { $pythonRunner = $candidate; break }
    } catch { }
}
if (-not $pythonRunner) { throw 'Python 3.9+ was not found. Install Python 3 and try again.' }
$env:PYTHONIOENCODING = 'utf-8'
$prefix = $pythonRunner.Prefix
$serverArgs = @((Join-Path $PSScriptRoot 'serve.py'), $Action)
if ($NoBrowser) { $serverArgs += '--no-browser' }
& $pythonRunner.Exe @prefix @serverArgs
if ($LASTEXITCODE -ne 0) { throw 'Site launcher failed. See .runtime/server.log for details.' }
