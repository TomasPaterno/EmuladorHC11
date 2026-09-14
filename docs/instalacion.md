# Guía de Descarga e Instalación del Emulador HC11

Esta guía explica paso a paso cómo descargar, instalar y ejecutar el **Emulador Motorola 68HC11** en **Windows**, **macOS** y **Linux** de la forma más rápida y sencilla, sin necesidad de instalar entornos de desarrollo ni herramientas adicionales.

---

## 1. Dónde descargar el programa

Las versiones compiladas y listas para usar se encuentran publicadas en la sección oficial de **Releases** del repositorio:

👉 **[Descargar última versión en GitHub Releases](https://github.com/TomasPaterno/EmuladorHC11/releases)**

Al final de la última versión publicada, despliega la sección **Assets** para descargar el archivo correspondiente a tu sistema operativo:

| Sistema Operativo                  | Archivo a descargar                      | Descripción                                                  |
| :--------------------------------- | :--------------------------------------- | :----------------------------------------------------------- |
| **Windows** (10 / 11)              | `Emulador-HC11_<versión>_x64-setup.exe`  | Instalador guiado estándar de Windows con accesos directos.  |
| **macOS** (Apple Silicon e Intel)  | `Emulador-HC11_<versión>_universal.dmg`  | Imagen de disco universal para Mac (M1/M2/M3/M4 e Intel).    |
| **Linux** (Todas las distros)      | `Emulador-HC11_<versión>_amd64.AppImage` | Ejecutable portable universal (no requiere instalación).     |
| **Linux** (Ubuntu / Debian / Mint) | `Emulador-HC11_<versión>_amd64.deb`      | Paquete instalador nativo para distribuciones Debian/Ubuntu. |

---

## 2. Instalación en Windows

### Paso 1: Descarga y ejecución

1. Descarga el archivo `Emulador-HC11_<versión>_x64-setup.exe`.
2. Haz doble clic en el archivo descargado para iniciar la instalación.

### Paso 2: Aviso de seguridad en el primer uso (Windows SmartScreen)

Dado que la aplicación es de código abierto y no cuenta con un certificado comercial corporativo de firma de código (EV Code Signing), Windows Defender SmartScreen puede mostrar un diálogo informativo en la primera ejecución:

> _"Windows protegió su PC: SmartScreen de Microsoft Defender impidió el inicio de una aplicación no reconocida."_

**Para continuar con la instalación:**

1. Haz clic en el enlace **"Más información"**.
2. Haz clic en el botón **"Ejecutar de todas formas"**.

### Paso 3: Asistente de instalación

Sigue las indicaciones del asistente de instalación. La aplicación creará los accesos directos correspondientes en el menú de inicio y en el escritorio.

---

## 3. Instalación en macOS

### Paso 1: Descarga y montaje

1. Descarga el archivo `Emulador-HC11_<versión>_universal.dmg`.
2. Haz doble clic en el archivo `.dmg` descargado para abrir la ventana de instalación.
3. Arrastra el ícono de **Emulador HC11** hacia la carpeta **Aplicaciones**.

### Paso 2: Permiso de ejecución inicial (Apple Gatekeeper)

Al no distribuirse mediante la Mac App Store, macOS Gatekeeper puede solicitar confirmación al ejecutar la aplicación por primera vez:

> _"No se puede abrir 'Emulador HC11' porque el desarrollador no ha sido verificado."_

Para autorizar la ejecución:

#### Método A: Desde Ajustes del Sistema (Recomendado)

1. Abre **Ajustes del Sistema** (o _Preferencias del Sistema_).
2. Dirígete a **Privacidad y seguridad** y desplázate hasta la sección **Seguridad**.
3. En la notificación que indica que se bloqueó el uso de la aplicación, haz clic en **"Abrir de todos modos"**.
4. Confirma con tus credenciales del sistema. La autorización queda registrada permanentemente.

#### Método B: Por Terminal (Comando rápido)

Si estás acostumbrado a usar la terminal, puedes quitar la marca de cuarentena ejecutando este comando:

```bash
xattr -cr /Applications/Emulador\ HC11.app
```

---

## 4. Instalación en Linux

### Opción A: Usando AppImage (Recomendada y universal)

El formato AppImage no requiere privilegios de administrador ni instalación en el sistema:

1. Descarga el archivo `Emulador-HC11_<versión>_amd64.AppImage`.
2. Otorga permisos de ejecución al archivo:
   - **Desde la interfaz gráfica:** Clic derecho sobre el archivo > _Propiedades_ > pestaña _Permisos_ > activar la casilla _"Permitir ejecutar el archivo como un programa"_.
   - **Desde la terminal:**
     ```bash
     chmod +x Emulador-HC11_*_amd64.AppImage
     ```
3. Haz doble clic en el archivo `.AppImage` (o ejecútalo desde la terminal con `./Emulador-HC11_*_amd64.AppImage`) para abrir el emulador.

### Opción B: Usando el paquete DEB (Ubuntu, Debian, Linux Mint)

1. Descarga el archivo `Emulador-HC11_<versión>_amd64.deb`.
2. Haz doble clic para abrir el instalador de paquetes de tu distribución, o instálalo desde la terminal:
   ```bash
   sudo dpkg -i Emulador-HC11_*_amd64.deb
   ```
3. Encontrarás el **Emulador HC11** en el menú de aplicaciones de tu entorno de escritorio.

---

## 5. Preguntas Frecuentes y Solución de Problemas

### ¿Por qué mi antivirus o navegador muestra advertencias al descargar?

Los navegadores y sistemas operativos marcan los ejecutables nuevos o de código abierto como "poco comunes" o "de autor desconocido" si no cuentan con una firma digital comercial corporativa. El código fuente de este proyecto es 100% auditable y abierto en este repositorio.

### En Windows 10 no se abre la ventana o pide WebView2

El emulador utiliza el motor WebView2 del sistema operativo para renderizar la interfaz gráfica de usuario. Windows 11 y casi todas las versiones modernas de Windows 10 ya lo traen preinstalado. Si utilizas una versión antigua de Windows 10 desactualizada, puedes instalar el componente oficial gratuito [Microsoft Edge WebView2 Runtime](https://developer.microsoft.com/es-es/microsoft-edge/webview2/).

### En Linux el programa no inicia por falta de librerías

Asegúrate de contar con las librerías gráficas de WebKitGTK instaladas en tu sistema:

- **Ubuntu/Debian:** `sudo apt install libwebkit2gtk-4.1-0`
- **Fedora:** `sudo dnf install webkit2gtk4.1`
- **Arch Linux:** `sudo pacman -S webkit2gtk-4.1`

### ¿Cómo desinstalo la aplicación?

- **Windows:** Desde _Configuración_ > _Aplicaciones instaladas_ > Buscar _Emulador HC11_ y seleccionar _Desinstalar_.
- **macOS:** Simplemente arrastra la aplicación desde la carpeta _Aplicaciones_ hacia el _Basurero_.
- **Linux (AppImage):** Solo borra el archivo `.AppImage`.
- **Linux (DEB):** Ejecuta `sudo apt remove emulador-hc11`.
