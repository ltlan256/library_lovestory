param([string]$Compiler = "gcc")

$ErrorActionPreference = "Stop"
$projectRoot = Split-Path -Parent $PSScriptRoot
if ($Compiler -eq "gcc" -and -not (Get-Command gcc -ErrorAction SilentlyContinue)) {
    $portableCompiler = Join-Path $projectRoot "build/tools/w64devkit/bin/gcc.exe"
    if (Test-Path -LiteralPath $portableCompiler) { $Compiler = $portableCompiler }
}
$compilerCommand = Get-Command $Compiler -ErrorAction SilentlyContinue
if (-not $compilerCommand) {
    throw "GCC not found. Install MinGW-w64/w64devkit and add its bin directory to PATH, or use -Compiler <path-to-gcc.exe>."
}

Push-Location $projectRoot
try {
    New-Item -ItemType Directory -Force -Path "build" | Out-Null
    $compilerArgs = @("-std=c11", "-g", "-Wall", "-Wextra", "-Wpedantic", "-Wshadow", "-Wformat=2",
        "-finput-charset=UTF-8", "-fexec-charset=UTF-8")
    $compilerArgs += @(Get-ChildItem -LiteralPath "src" -Filter "*.c" | Sort-Object Name | ForEach-Object { $_.FullName })
    $compilerArgs += @("-o", "build/library.exe", "-lwinmm")
    & $compilerCommand.Source @compilerArgs
    if ($LASTEXITCODE -ne 0) { throw "Compilation failed (exit code $LASTEXITCODE)." }
    Write-Host "Build succeeded: build/library.exe"
    Write-Host "Run from the project root: .\build\library.exe"
} finally {
    Pop-Location
}
