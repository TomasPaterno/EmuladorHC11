# Pipeline reproducible de documentación

La puerta de calidad de la Fase 0 es `npm run docs:validate`, que comprueba
hashes, tamaños, `source_id` y rangos de vectores contra
`docs/hardware/manifest.yaml` y `docs/hardware/spec/`.

El pipeline PowerShell es opcional: extrae texto por página para búsqueda. El
OCR de RM3 no es normativo y no se exige para cerrar la fundación. Los
derivados no se versionan.

## Prerrequisitos (Windows)

- Windows PowerShell 5.1 o PowerShell 7.
- Poppler en `PATH`: `pdfinfo`, `pdftotext` y, para Tesseract, `pdftoppm`.
- Para validar YAML: módulo `powershell-yaml`.
- OCR opcional:
  - Tesseract en `PATH`, con los idiomas solicitados instalados.
  - OCRmyPDF en `PATH`, junto con sus dependencias (Tesseract y Ghostscript).

Instalación del módulo YAML:

```powershell
Install-Module powershell-yaml -Scope CurrentUser
```

Poppler, Tesseract y OCRmyPDF deben instalarse desde paquetes confiables para el entorno. Verifique la instalación:

```powershell
Get-Command pdfinfo,pdftotext
Get-Command pdftoppm,tesseract       # solo OCR con Tesseract
Get-Command ocrmypdf                 # solo OCR con OCRmyPDF
```

## Ejecución

Desde la raíz del repositorio:

```powershell
# Extracción sin OCR
.\scripts\docs\Invoke-DocsPipeline.ps1

# OCR únicamente para páginas cuya extracción inicial no contiene texto
.\scripts\docs\Invoke-DocsPipeline.ps1 -OcrEngine Tesseract -OcrLanguage eng

# OCRmyPDF crea copias derivadas en docs/hardware/derived/ocr
.\scripts\docs\Invoke-DocsPipeline.ps1 -OcrEngine OCRmyPDF -OcrLanguage eng

# Directorios explícitos
.\scripts\docs\Invoke-DocsPipeline.ps1 `
  -InputDirectory .\manuales `
  -OutputDirectory .\artifacts\docs
```

La entrada no se recorre recursivamente. La salida se ordena por nombre del PDF y los identificadores incluyen los primeros 12 caracteres del SHA-256. Cada ejecución reemplaza solo la carpeta generada de cada documento. Si no hay PDFs o falta una herramienta requerida, el script falla sin publicar resultados inventados.

OCRmyPDF procesa una copia completa con `--skip-text`; después solo se toma texto de esa copia para las páginas que estaban vacías. Tesseract rasteriza esas páginas en un directorio temporal y no crea un PDF nuevo. Ninguna modalidad escribe sobre el original.

## Contratos YAML

El validador acepta este perfil:

```yaml
# manifest.yaml (lo genera el pipeline)
schema_version: 1
documents:
  - id: "manual-a"
    source_path: "../../../manual.pdf"
    sha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
    page_count: 100

# citations.yaml
schema_version: 1
citations:
  - id: "cite-reset-vector"
    document_id: "manual-a"
    page: 7

# spec.yaml
schema_version: 1
requirements:
  - id: "cpu-reset-vector"
    text: "El emulador debe leer el vector de reset."
    citations:
      - "cite-reset-vector"
```

Se validan versión, campos obligatorios, IDs únicos, formato SHA-256, rangos de página y referencias entre documentos, citas y requisitos. `-CheckFiles` además verifica existencia, hash y número real de páginas.

```powershell
.\scripts\docs\Validate-DocsYaml.ps1 `
  -ManifestPath .\docs\hardware\derived\manifest.yaml `
  -CitationsPath .\docs\citations.yaml `
  -SpecPath .\docs\spec.yaml `
  -CheckFiles

# Ejecutar pipeline y validar al terminar
.\scripts\docs\Invoke-DocsPipeline.ps1 `
  -CitationsPath .\docs\citations.yaml `
  -SpecPath .\docs\spec.yaml `
  -ValidateYaml
```

## Test mínimo del validador

No requiere Pester ni un parser YAML porque prueba directamente las reglas estructurales:

```powershell
.\scripts\docs\tests\Test-DocsValidation.ps1
```
