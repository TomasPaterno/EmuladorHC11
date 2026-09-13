# Preparación del entorno

## Versiones de referencia

La base fue planificada para Node.js 22.22, npm 11.6 y Rust/Cargo 1.96 con
`rustfmt`, Clippy y el toolchain MSVC en Windows. Compruebe la instalación:

```text
node --version
npm --version
rustc --version
cargo --version
```

## Dependencias del sistema

- Windows: Microsoft C++ Build Tools y WebView2 Runtime.
- macOS: Xcode Command Line Tools; Tauri usa WKWebView.
- Linux: toolchain de compilación y paquetes WebKitGTK requeridos por Tauri para
  la distribución concreta; Tauri usa WebKitGTK.

Comandos de referencia:

```powershell
# Windows (PowerShell); luego elegir “Desktop development with C++”
winget install --id Microsoft.VisualStudio.2022.BuildTools --exact
winget install --id Rustlang.Rustup --exact
```

```bash
# macOS
xcode-select --install
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh

# Debian/Ubuntu, lista oficial de Tauri v2
sudo apt update
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
curl --proto '=https' --tlsv1.2 https://sh.rustup.rs -sSf | sh
```

Para otras distribuciones, use la
[lista oficial de prerrequisitos de Tauri v2](https://v2.tauri.app/start/prerequisites/).

## Reproducción del scaffold

La creación inicial equivalente fue:

```text
npm create tauri-app@latest emulador-hc11 -- --template react-ts --manager npm
cd emulador-hc11
npm install dockview-react tailwindcss @tailwindcss/vite
npm install --save-dev eslint prettier typescript-eslint yaml
```

El repositorio ya conserva esas decisiones en sus manifests y lockfiles; no se
debe volver a ejecutar el generador sobre este árbol.

## Instalación y ejecución

Desde la raíz:

```text
npm ci
npm run tauri dev
npm run tauri build
```

`npm run tauri dev` abre la ventana nativa. `npm run dev` no es el emulador:
solo sirve el frontend que Tauri incrusta. No abra `localhost:1420` en un
navegador. `npm ci` usa el lockfile existente. La aplicación no requiere
Chrome, Firefox o Edge, pero sí el webview del sistema.

## Comprobaciones Rust disponibles

```text
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

La verificación completa y reproducible está disponible como:

```text
npm run check
```

Ese comando cubre formato, lint, build frontend, rustfmt, Clippy, tests Rust
y validación de hashes del corpus. El OCR de RM3 no forma parte de `check`.

La configuración de Tailwind v4 sigue el plugin oficial `@tailwindcss/vite` y
`src/App.css` importa `tailwindcss`.
