[CmdletBinding()]
param(
    [string]$InputDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..\..\docs\hardware\original')).Path,
    [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\..\docs\hardware\derived'),
    [ValidateSet('None', 'Tesseract', 'OCRmyPDF')][string]$OcrEngine = 'None',
    [string]$OcrLanguage = 'eng',
    [string]$CitationsPath,
    [string]$SpecPath,
    [switch]$ValidateYaml
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Assert-Command {
    param([Parameter(Mandatory = $true)][string]$Name)
    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "No se encontró '$Name' en PATH. Consulte $PSScriptRoot\README.md."
    }
    return $command.Source
}

function Write-Utf8 {
    param([string]$Path, [AllowEmptyString()][string]$Content)
    [System.IO.File]::WriteAllText($Path, $Content, $utf8NoBom)
}

function Quote-Yaml {
    param([AllowEmptyString()][string]$Value)
    return ($Value | ConvertTo-Json -Compress)
}

function Get-RelativePath {
    param([string]$FromDirectory, [string]$ToPath)
    $from = [System.IO.Path]::GetFullPath($FromDirectory).TrimEnd('\', '/') + [System.IO.Path]::DirectorySeparatorChar
    $to = [System.IO.Path]::GetFullPath($ToPath)
    $fromUri = New-Object System.Uri($from)
    $toUri = New-Object System.Uri($to)
    return [System.Uri]::UnescapeDataString($fromUri.MakeRelativeUri($toUri).ToString())
}

function Invoke-Native {
    param(
        [string]$Command,
        [string[]]$Arguments,
        [string]$Description
    )
    $output = & $Command @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$Description falló (código $LASTEXITCODE): $($output -join ' ')"
    }
    return @($output)
}

function Convert-PdfInfo {
    param([string[]]$Lines)
    $result = [ordered]@{}
    foreach ($line in $Lines) {
        if ([string]$line -match '^([^:]+):\s*(.*)$') {
            $key = $Matches[1].Trim().ToLowerInvariant() -replace '[^a-z0-9]+', '_'
            $result[$key.Trim('_')] = $Matches[2].Trim()
        }
    }
    return $result
}

function Get-TextCoverage {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
    return ([System.IO.File]::ReadAllText($Path) -match '\S')
}

$inputRoot = (Resolve-Path -LiteralPath $InputDirectory).Path
$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
if ($inputRoot.TrimEnd('\') -eq $outputRoot.TrimEnd('\')) {
    throw 'InputDirectory y OutputDirectory no pueden ser el mismo directorio.'
}

$pdfinfoCommand = Assert-Command 'pdfinfo'
$pdftotextCommand = Assert-Command 'pdftotext'
$pdftoppmCommand = $null
$tesseractCommand = $null
$ocrmypdfCommand = $null
if ($OcrEngine -eq 'Tesseract') {
    $pdftoppmCommand = Assert-Command 'pdftoppm'
    $tesseractCommand = Assert-Command 'tesseract'
} elseif ($OcrEngine -eq 'OCRmyPDF') {
    $ocrmypdfCommand = Assert-Command 'ocrmypdf'
}

$pdfFiles = @(Get-ChildItem -LiteralPath $inputRoot -Filter '*.pdf' -File | Sort-Object Name)
if ($pdfFiles.Count -eq 0) {
    throw "No se encontraron PDFs en '$inputRoot'; no se generaron resultados."
}

[System.IO.Directory]::CreateDirectory($outputRoot) | Out-Null
$documents = New-Object System.Collections.Generic.List[object]

foreach ($pdf in $pdfFiles) {
    $hash = (Get-FileHash -LiteralPath $pdf.FullName -Algorithm SHA256).Hash.ToLowerInvariant()
    $safeStem = ($pdf.BaseName -replace '[^A-Za-z0-9._-]+', '-').Trim('-')
    if ([string]::IsNullOrWhiteSpace($safeStem)) { $safeStem = 'document' }
    $documentId = "$safeStem-$($hash.Substring(0, 12))"
    $documentDirectory = Join-Path $outputRoot $documentId
    $pagesDirectory = Join-Path $documentDirectory 'pages'

    if (Test-Path -LiteralPath $documentDirectory) {
        Remove-Item -LiteralPath $documentDirectory -Recurse -Force
    }
    [System.IO.Directory]::CreateDirectory($pagesDirectory) | Out-Null

    $infoLines = Invoke-Native $pdfinfoCommand @($pdf.FullName) "pdfinfo para '$($pdf.Name)'"
    $metadata = Convert-PdfInfo $infoLines
    if (-not $metadata.Contains('pages') -or $metadata['pages'] -notmatch '^\d+$') {
        throw "pdfinfo no devolvió una cantidad válida de páginas para '$($pdf.Name)'."
    }
    $pageCount = [int]$metadata['pages']
    if ($pageCount -lt 1) {
        throw "'$($pdf.Name)' no contiene páginas."
    }

    $blankPages = New-Object System.Collections.Generic.List[int]
    for ($page = 1; $page -le $pageCount; $page++) {
        $textPath = Join-Path $pagesDirectory ('page-{0:D4}.txt' -f $page)
        Invoke-Native $pdftotextCommand @('-f', "$page", '-l', "$page", '-layout', '-nopgbrk', '-enc', 'UTF-8', $pdf.FullName, $textPath) "pdftotext, página $page de '$($pdf.Name)'" | Out-Null
        if (-not (Get-TextCoverage $textPath)) {
            Write-Utf8 $textPath ''
            $blankPages.Add($page)
        }
    }

    $ocrPages = New-Object System.Collections.Generic.List[int]
    $ocrPdfPath = $null
    if ($blankPages.Count -gt 0 -and $OcrEngine -eq 'OCRmyPDF') {
        $ocrDirectory = Join-Path $outputRoot 'ocr'
        [System.IO.Directory]::CreateDirectory($ocrDirectory) | Out-Null
        $ocrPdfPath = Join-Path $ocrDirectory "$documentId.ocr.pdf"
        if (Test-Path -LiteralPath $ocrPdfPath) { Remove-Item -LiteralPath $ocrPdfPath -Force }
        Invoke-Native $ocrmypdfCommand @('--skip-text', '--deskew', '--output-type', 'pdf', '--language', $OcrLanguage, $pdf.FullName, $ocrPdfPath) "OCRmyPDF para '$($pdf.Name)'" | Out-Null

        foreach ($page in $blankPages) {
            $textPath = Join-Path $pagesDirectory ('page-{0:D4}.txt' -f $page)
            Invoke-Native $pdftotextCommand @('-f', "$page", '-l', "$page", '-layout', '-nopgbrk', '-enc', 'UTF-8', $ocrPdfPath, $textPath) "pdftotext OCR, página $page de '$($pdf.Name)'" | Out-Null
            if (Get-TextCoverage $textPath) { $ocrPages.Add($page) } else { Write-Utf8 $textPath '' }
        }
    } elseif ($blankPages.Count -gt 0 -and $OcrEngine -eq 'Tesseract') {
        $tempDirectory = Join-Path $documentDirectory '.ocr-temp'
        [System.IO.Directory]::CreateDirectory($tempDirectory) | Out-Null
        try {
            foreach ($page in $blankPages) {
                $imagePrefix = Join-Path $tempDirectory ('page-{0:D4}' -f $page)
                Invoke-Native $pdftoppmCommand @('-f', "$page", '-l', "$page", '-singlefile', '-r', '300', '-png', $pdf.FullName, $imagePrefix) "pdftoppm, página $page de '$($pdf.Name)'" | Out-Null
                $imagePath = "$imagePrefix.png"
                $ocrOutput = Invoke-Native $tesseractCommand @($imagePath, 'stdout', '-l', $OcrLanguage) "Tesseract, página $page de '$($pdf.Name)'"
                $text = $ocrOutput -join [Environment]::NewLine
                $textPath = Join-Path $pagesDirectory ('page-{0:D4}.txt' -f $page)
                Write-Utf8 $textPath $text
                if ($text -match '\S') { $ocrPages.Add($page) }
            }
        } finally {
            Remove-Item -LiteralPath $tempDirectory -Recurse -Force -ErrorAction SilentlyContinue
        }
    }

    $pagesWithText = 0
    $pagesWithoutText = New-Object System.Collections.Generic.List[int]
    for ($page = 1; $page -le $pageCount; $page++) {
        $textPath = Join-Path $pagesDirectory ('page-{0:D4}.txt' -f $page)
        if (Get-TextCoverage $textPath) { $pagesWithText++ } else { $pagesWithoutText.Add($page) }
    }

    $documents.Add([pscustomobject][ordered]@{
        id                 = $documentId
        source_path        = Get-RelativePath $outputRoot $pdf.FullName
        sha256             = $hash
        size_bytes         = $pdf.Length
        modified_utc       = $pdf.LastWriteTimeUtc.ToString('o')
        page_count         = $pageCount
        metadata           = $metadata
        pages_with_text    = $pagesWithText
        pages_without_text = @($pagesWithoutText)
        coverage_percent   = [math]::Round(($pagesWithText * 100.0) / $pageCount, 2)
        ocr_engine         = $OcrEngine
        ocr_pages          = @($ocrPages)
        text_directory     = Get-RelativePath $outputRoot $pagesDirectory
        ocr_pdf            = if ($null -ne $ocrPdfPath) { Get-RelativePath $outputRoot $ocrPdfPath } else { $null }
    })
}

$manifestLines = New-Object System.Collections.Generic.List[string]
$manifestLines.Add('schema_version: 1')
$manifestLines.Add('documents:')
foreach ($document in $documents) {
    $manifestLines.Add("  - id: $(Quote-Yaml $document.id)")
    $manifestLines.Add("    source_path: $(Quote-Yaml $document.source_path)")
    $manifestLines.Add("    sha256: $(Quote-Yaml $document.sha256)")
    $manifestLines.Add("    size_bytes: $($document.size_bytes)")
    $manifestLines.Add("    modified_utc: $(Quote-Yaml $document.modified_utc)")
    $manifestLines.Add("    page_count: $($document.page_count)")
    $manifestLines.Add("    text_directory: $(Quote-Yaml $document.text_directory)")
    $manifestLines.Add("    extraction:")
    $manifestLines.Add("      pages_with_text: $($document.pages_with_text)")
    $manifestLines.Add("      pages_without_text: $(@($document.pages_without_text) | ConvertTo-Json -Compress)")
    $manifestLines.Add("      coverage_percent: $($document.coverage_percent.ToString([System.Globalization.CultureInfo]::InvariantCulture))")
    $manifestLines.Add("      ocr_engine: $(Quote-Yaml $document.ocr_engine)")
    $manifestLines.Add("      ocr_pages: $(@($document.ocr_pages) | ConvertTo-Json -Compress)")
    if ($null -ne $document.ocr_pdf) {
        $manifestLines.Add("      ocr_pdf: $(Quote-Yaml $document.ocr_pdf)")
    }
    $manifestLines.Add('    pdf_metadata:')
    foreach ($entry in $document.metadata.GetEnumerator() | Sort-Object Key) {
        if ($entry.Key -eq 'pages') { continue }
        $manifestLines.Add("      $($entry.Key): $(Quote-Yaml ([string]$entry.Value))")
    }
}
$manifestPath = Join-Path $outputRoot 'manifest.yaml'
Write-Utf8 $manifestPath ($manifestLines -join "`n")

$coverage = [pscustomobject][ordered]@{
    schema_version = 1
    documents      = @($documents | ForEach-Object {
        [pscustomobject][ordered]@{
            id                 = $_.id
            page_count         = $_.page_count
            pages_with_text    = $_.pages_with_text
            pages_without_text = @($_.pages_without_text)
            coverage_percent   = $_.coverage_percent
            ocr_engine         = $_.ocr_engine
            ocr_pages          = @($_.ocr_pages)
        }
    })
}
Write-Utf8 (Join-Path $outputRoot 'coverage.json') ($coverage | ConvertTo-Json -Depth 6)

$reportLines = New-Object System.Collections.Generic.List[string]
$reportLines.Add('# Cobertura de extracción')
$reportLines.Add('')
$reportLines.Add('| Documento | Páginas | Con texto | Sin texto | Cobertura | OCR |')
$reportLines.Add('|---|---:|---:|---:|---:|---|')
foreach ($document in $documents) {
    $blank = if (@($document.pages_without_text).Count -eq 0) { '—' } else { @($document.pages_without_text) -join ', ' }
    $reportLines.Add("| $($document.id) | $($document.page_count) | $($document.pages_with_text) | $blank | $($document.coverage_percent)% | $($document.ocr_engine) |")
}
Write-Utf8 (Join-Path $outputRoot 'coverage.md') ($reportLines -join "`n")

if ($ValidateYaml) {
    if ([string]::IsNullOrWhiteSpace($CitationsPath) -or [string]::IsNullOrWhiteSpace($SpecPath)) {
        throw '-ValidateYaml requiere -CitationsPath y -SpecPath.'
    }
    & (Join-Path $PSScriptRoot 'Validate-DocsYaml.ps1') -ManifestPath $manifestPath -CitationsPath $CitationsPath -SpecPath $SpecPath -CheckFiles
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host "Pipeline completado. Manifest: $manifestPath"
