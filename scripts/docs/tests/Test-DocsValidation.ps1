Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

Import-Module (Join-Path $PSScriptRoot '..\DocsValidation.psm1') -Force

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "TEST FAILED: $Message" }
}

$manifest = [pscustomobject]@{
    schema_version = 1
    documents = @(
        [pscustomobject]@{
            id = 'manual-a'
            source_path = '..\manual.pdf'
            sha256 = ('a' * 64)
            page_count = 10
        }
    )
}
$citations = [pscustomobject]@{
    schema_version = 1
    citations = @(
        [pscustomobject]@{
            id = 'cite-reset-vector'
            document_id = 'manual-a'
            page = 7
        }
    )
}
$spec = [pscustomobject]@{
    schema_version = 1
    requirements = @(
        [pscustomobject]@{
            id = 'cpu-reset-vector'
            text = 'El emulador debe leer el vector de reset.'
            citations = @('cite-reset-vector')
        }
    )
}

$validResult = Test-DocsData -Manifest $manifest -Citations $citations -Spec $spec
Assert-True $validResult.Valid 'un conjunto consistente debe ser válido'

$badCitations = [pscustomobject]@{
    schema_version = 1
    citations = @(
        [pscustomobject]@{
            id = 'cite-bad-page'
            document_id = 'manual-a'
            page = 11
        }
    )
}
$invalidResult = Test-DocsData -Manifest $manifest -Citations $badCitations -Spec $spec
Assert-True (-not $invalidResult.Valid) 'una página fuera de rango y una cita inexistente deben fallar'
Assert-True (($invalidResult.Errors -join "`n") -match 'excede page_count') 'debe informar la página fuera de rango'
Assert-True (($invalidResult.Errors -join "`n") -match 'no existe') 'debe informar la cita inexistente'

Write-Host 'OK: 2 casos de validación superados.'
