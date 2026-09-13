[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$ManifestPath,
    [Parameter(Mandatory = $true)][string]$CitationsPath,
    [Parameter(Mandatory = $true)][string]$SpecPath,
    [switch]$CheckFiles
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Read-YamlDocument {
    param([Parameter(Mandatory = $true)][string]$Path)

    $resolved = Resolve-Path -LiteralPath $Path -ErrorAction Stop
    if (-not (Get-Command ConvertFrom-Yaml -ErrorAction SilentlyContinue)) {
        try {
            Import-Module powershell-yaml -ErrorAction Stop
        } catch {
            throw "No se encontró ConvertFrom-Yaml. Instale powershell-yaml: Install-Module powershell-yaml -Scope CurrentUser"
        }
    }

    try {
        return (Get-Content -LiteralPath $resolved.Path -Raw -Encoding UTF8 | ConvertFrom-Yaml)
    } catch {
        throw "YAML inválido en '$Path': $($_.Exception.Message)"
    }
}

function Get-Field {
    param($Object, [string]$Name)
    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) { return $Object[$Name] }
        return $null
    }
    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}

$manifest = Read-YamlDocument $ManifestPath
$citations = Read-YamlDocument $CitationsPath
$spec = Read-YamlDocument $SpecPath

Import-Module (Join-Path $PSScriptRoot 'DocsValidation.psm1') -Force
$result = Test-DocsData -Manifest $manifest -Citations $citations -Spec $spec
$errors = New-Object System.Collections.Generic.List[string]
foreach ($validationError in $result.Errors) {
    $errors.Add([string]$validationError)
}

if ($CheckFiles) {
    $pdfinfo = Get-Command pdfinfo -ErrorAction SilentlyContinue
    if ($null -eq $pdfinfo) {
        $errors.Add('No se encontró pdfinfo (Poppler); es necesario para -CheckFiles.')
    }

    $manifestDirectory = Split-Path (Resolve-Path -LiteralPath $ManifestPath).Path -Parent
    foreach ($document in @(Get-Field $manifest 'documents')) {
        $id = [string](Get-Field $document 'id')
        $sourcePath = [string](Get-Field $document 'source_path')
        if ([string]::IsNullOrWhiteSpace($sourcePath)) { continue }

        $absolutePath = if ([System.IO.Path]::IsPathRooted($sourcePath)) {
            [System.IO.Path]::GetFullPath($sourcePath)
        } else {
            [System.IO.Path]::GetFullPath((Join-Path $manifestDirectory $sourcePath))
        }

        if (-not (Test-Path -LiteralPath $absolutePath -PathType Leaf)) {
            $errors.Add("manifest: no existe el PDF '$sourcePath' de '$id'.")
            continue
        }

        $expectedHash = [string](Get-Field $document 'sha256')
        $actualHash = (Get-FileHash -LiteralPath $absolutePath -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash.ToLowerInvariant()) {
            $errors.Add("manifest: SHA-256 no coincide para '$id'.")
        }

        if ($null -ne $pdfinfo) {
            $infoOutput = & $pdfinfo.Source $absolutePath 2>&1
            if ($LASTEXITCODE -ne 0) {
                $errors.Add("manifest: pdfinfo falló para '$id': $($infoOutput -join ' ')")
            } else {
                $pageLine = $infoOutput | Where-Object { $_ -match '^Pages:\s+(\d+)\s*$' } | Select-Object -First 1
                if ($null -eq $pageLine) {
                    $errors.Add("manifest: pdfinfo no informó páginas para '$id'.")
                } else {
                    [void]($pageLine -match '^Pages:\s+(\d+)\s*$')
                    $actualPages = [int]$Matches[1]
                    $expectedPages = [int](Get-Field $document 'page_count')
                    if ($actualPages -ne $expectedPages) {
                        $errors.Add("manifest: page_count no coincide para '$id' (esperado $expectedPages, real $actualPages).")
                    }
                }
            }
        }
    }
}

if ($errors.Count -gt 0) {
    Write-Error ("Validación fallida:`n - " + ($errors -join "`n - "))
    exit 1
}

Write-Host 'Manifest, citas y spec válidos.'
