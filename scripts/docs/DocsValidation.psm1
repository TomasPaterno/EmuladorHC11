Set-StrictMode -Version 2.0

function Get-DocsField {
    param(
        [Parameter(Mandatory = $true)]$Object,
        [Parameter(Mandatory = $true)][string]$Name
    )

    if ($null -eq $Object) { return $null }
    if ($Object -is [System.Collections.IDictionary]) {
        if ($Object.Contains($Name)) { return $Object[$Name] }
        return $null
    }

    $property = $Object.PSObject.Properties[$Name]
    if ($null -ne $property) { return $property.Value }
    return $null
}

function ConvertTo-DocsArray {
    param($Value)
    if ($null -eq $Value) { return @() }
    return @($Value)
}

function Test-DocsData {
    [CmdletBinding()]
    param(
        [Parameter(Mandatory = $true)]$Manifest,
        [Parameter(Mandatory = $true)]$Citations,
        [Parameter(Mandatory = $true)]$Spec
    )

    $errors = New-Object System.Collections.Generic.List[string]
    $documentIds = @{}
    $documentPages = @{}
    $citationIds = @{}
    $requirementIds = @{}

    if ((Get-DocsField $Manifest 'schema_version') -ne 1) {
        $errors.Add('manifest.schema_version debe ser 1.')
    }

    $documents = ConvertTo-DocsArray (Get-DocsField $Manifest 'documents')
    if ($documents.Count -eq 0) {
        $errors.Add('manifest.documents debe contener al menos un documento.')
    }

    for ($index = 0; $index -lt $documents.Count; $index++) {
        $document = $documents[$index]
        $prefix = "manifest.documents[$index]"
        $id = [string](Get-DocsField $document 'id')
        $path = [string](Get-DocsField $document 'source_path')
        $hash = [string](Get-DocsField $document 'sha256')
        $pageCount = Get-DocsField $document 'page_count'

        if ([string]::IsNullOrWhiteSpace($id)) {
            $errors.Add("$prefix.id es obligatorio.")
        } elseif ($documentIds.ContainsKey($id)) {
            $errors.Add("$prefix.id '$id' está duplicado.")
        } else {
            $documentIds[$id] = $true
        }

        if ([string]::IsNullOrWhiteSpace($path)) {
            $errors.Add("$prefix.source_path es obligatorio.")
        }
        if ($hash -notmatch '^[0-9a-fA-F]{64}$') {
            $errors.Add("$prefix.sha256 debe ser un SHA-256 hexadecimal de 64 caracteres.")
        }

        $parsedPages = 0
        if ($null -eq $pageCount -or -not [int]::TryParse([string]$pageCount, [ref]$parsedPages) -or $parsedPages -lt 1) {
            $errors.Add("$prefix.page_count debe ser un entero mayor que cero.")
        } elseif (-not [string]::IsNullOrWhiteSpace($id)) {
            $documentPages[$id] = $parsedPages
        }
    }

    if ((Get-DocsField $Citations 'schema_version') -ne 1) {
        $errors.Add('citations.schema_version debe ser 1.')
    }

    $citationList = ConvertTo-DocsArray (Get-DocsField $Citations 'citations')
    for ($index = 0; $index -lt $citationList.Count; $index++) {
        $citation = $citationList[$index]
        $prefix = "citations.citations[$index]"
        $id = [string](Get-DocsField $citation 'id')
        $documentId = [string](Get-DocsField $citation 'document_id')
        $page = Get-DocsField $citation 'page'
        $parsedPage = 0

        if ([string]::IsNullOrWhiteSpace($id)) {
            $errors.Add("$prefix.id es obligatorio.")
        } elseif ($citationIds.ContainsKey($id)) {
            $errors.Add("$prefix.id '$id' está duplicado.")
        } else {
            $citationIds[$id] = $true
        }

        if (-not $documentIds.ContainsKey($documentId)) {
            $errors.Add("$prefix.document_id '$documentId' no existe en el manifest.")
        }
        if ($null -eq $page -or -not [int]::TryParse([string]$page, [ref]$parsedPage) -or $parsedPage -lt 1) {
            $errors.Add("$prefix.page debe ser un entero mayor que cero.")
        } elseif ($documentPages.ContainsKey($documentId) -and $parsedPage -gt $documentPages[$documentId]) {
            $errors.Add("$prefix.page ($parsedPage) excede page_count ($($documentPages[$documentId])) de '$documentId'.")
        }
    }

    if ((Get-DocsField $Spec 'schema_version') -ne 1) {
        $errors.Add('spec.schema_version debe ser 1.')
    }

    $requirements = ConvertTo-DocsArray (Get-DocsField $Spec 'requirements')
    for ($index = 0; $index -lt $requirements.Count; $index++) {
        $requirement = $requirements[$index]
        $prefix = "spec.requirements[$index]"
        $id = [string](Get-DocsField $requirement 'id')
        $text = [string](Get-DocsField $requirement 'text')
        $references = ConvertTo-DocsArray (Get-DocsField $requirement 'citations')

        if ([string]::IsNullOrWhiteSpace($id)) {
            $errors.Add("$prefix.id es obligatorio.")
        } elseif ($requirementIds.ContainsKey($id)) {
            $errors.Add("$prefix.id '$id' está duplicado.")
        } else {
            $requirementIds[$id] = $true
        }
        if ([string]::IsNullOrWhiteSpace($text)) {
            $errors.Add("$prefix.text es obligatorio.")
        }
        if ($references.Count -eq 0) {
            $errors.Add("$prefix.citations debe contener al menos una cita.")
        }
        foreach ($reference in $references) {
            $citationId = [string]$reference
            if (-not $citationIds.ContainsKey($citationId)) {
                $errors.Add("$prefix.citations referencia '$citationId', que no existe.")
            }
        }
    }

    [pscustomobject]@{
        Valid  = ($errors.Count -eq 0)
        Errors = @($errors)
    }
}

Export-ModuleMember -Function Test-DocsData
