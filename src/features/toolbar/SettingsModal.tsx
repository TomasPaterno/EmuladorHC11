import { useEffect } from "react";
import { ByteFormat } from "../inspector/memoryFormat";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fontScale: number;
  onFontScaleChange: (scale: number) => void;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
  registersFormat: "hex" | "bin" | "dec";
  onRegistersFormatChange: (format: "hex" | "bin" | "dec") => void;
  programMemoryFormat: ByteFormat;
  onProgramMemoryFormatChange: (format: ByteFormat) => void;
  dataMemoryFormat: ByteFormat;
  onDataMemoryFormatChange: (format: ByteFormat) => void;
  onResetLayout: () => void;
}

const FONT_PRESETS = [
  { label: "Compacto", scale: 85 },
  { label: "Estándar", scale: 100 },
  { label: "Grande", scale: 115 },
  { label: "Extra Grande", scale: 130 },
];

export function SettingsModal({
  isOpen,
  onClose,
  fontScale,
  onFontScaleChange,
  theme,
  onThemeChange,
  registersFormat,
  onRegistersFormatChange,
  programMemoryFormat,
  onProgramMemoryFormatChange,
  dataMemoryFormat,
  onDataMemoryFormatChange,
  onResetLayout,
}: SettingsModalProps) {
  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function stepFont(delta: number) {
    const next = Math.min(135, Math.max(85, fontScale + delta));
    onFontScaleChange(next);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">⚙️</span>
            <div>
              <h3
                id="settings-dialog-title"
                className="text-base font-bold text-slate-100 tracking-tight"
              >
                Configuración del Emulador
              </h3>
              <p className="text-xs text-slate-400">
                Personalice la apariencia, tipografía y visualización
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar ventana de configuración"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 select-none">
          {/* Section 1: Font Size & Scaling */}
          <section aria-labelledby="font-size-title" className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4
                  id="font-size-title"
                  className="text-sm font-bold text-slate-200"
                >
                  Tamaño de Letra y Números
                </h4>
                <p className="text-xs text-slate-400">
                  Aumente o disminuya la escala de todos los contenidos,
                  registros y celdas de memoria.
                </p>
              </div>
              <span className="rounded-md border border-amber-500/40 bg-amber-400/10 px-2.5 py-1 font-mono text-sm font-bold text-amber-400">
                {fontScale}%
              </span>
            </div>

            {/* Steppers and Slider */}
            <div className="flex items-center gap-3 bg-slate-950/50 p-3 rounded-xl border border-slate-800/80">
              <button
                type="button"
                onClick={() => stepFont(-5)}
                disabled={fontScale <= 85}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Disminuir tamaño de letra (-5%)"
              >
                A−
              </button>

              <input
                type="range"
                min="85"
                max="135"
                step="5"
                value={fontScale}
                onChange={(e) => onFontScaleChange(Number(e.target.value))}
                className="flex-1 accent-amber-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
                aria-label="Ajustar porcentaje de escala de fuente"
              />

              <button
                type="button"
                onClick={() => stepFont(5)}
                disabled={fontScale >= 135}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-800 font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-40 transition-colors cursor-pointer"
                title="Aumentar tamaño de letra (+5%)"
              >
                A+
              </button>

              <button
                type="button"
                onClick={() => onFontScaleChange(100)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors cursor-pointer"
                title="Restablecer tamaño a 100%"
              >
                100%
              </button>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FONT_PRESETS.map((preset) => {
                const isActive = fontScale === preset.scale;
                return (
                  <button
                    key={preset.scale}
                    type="button"
                    onClick={() => onFontScaleChange(preset.scale)}
                    className={`rounded-lg border px-2.5 py-2 text-center transition-all cursor-pointer ${
                      isActive
                        ? "border-amber-400 bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/50 font-bold"
                        : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                    }`}
                  >
                    <div className="text-xs font-semibold">{preset.label}</div>
                    <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                      {preset.scale}%
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Preview Box */}
            <div className="rounded-lg border border-slate-800/80 bg-slate-950/70 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Vista previa en vivo:
              </div>
              <div className="font-mono text-xs sm:text-sm text-slate-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-amber-400 font-bold">$2000</span>
                <span className="text-slate-300 font-semibold">86 55</span>
                <span className="text-amber-300 font-medium">LDAA #$55</span>
                <span className="text-slate-500">|</span>
                <span>PC: $2002</span>
                <span>A: $55 (%0101 0101, 85)</span>
              </div>
            </div>
          </section>

          <hr className="border-slate-800" />

          {/* Section 2: Theme (Dark / Light) */}
          <section aria-labelledby="theme-title" className="space-y-3">
            <div>
              <h4 id="theme-title" className="text-sm font-bold text-slate-200">
                Tema Visual
              </h4>
              <p className="text-xs text-slate-400">
                Seleccione el esquema de colores de la interfaz.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onThemeChange("dark")}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                  theme === "dark"
                    ? "border-amber-400 bg-slate-950 text-slate-100 ring-1 ring-amber-400/50 shadow-sm"
                    : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-2xl">🌙</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Modo Oscuro</div>
                  <div className="text-xs text-slate-400">
                    Fondo oscuro para descansar la vista
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onThemeChange("light")}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer ${
                  theme === "light"
                    ? "border-amber-400 bg-white text-slate-900 ring-1 ring-amber-400/50 shadow-sm"
                    : "border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-2xl">☀️</span>
                <div className="text-left">
                  <div className="text-sm font-bold">Modo Claro</div>
                  <div className="text-xs text-slate-500">
                    Alto contraste en entornos iluminados
                  </div>
                </div>
              </button>
            </div>
          </section>

          <hr className="border-slate-800" />

          {/* Section 3: Numerical Formats */}
          <section aria-labelledby="formats-title" className="space-y-3">
            <div>
              <h4
                id="formats-title"
                className="text-sm font-bold text-slate-200"
              >
                Formatos Numéricos
              </h4>
              <p className="text-xs text-slate-400">
                Seleccione la representación numérica preferida para registros y
                memoria.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Registers Format */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Registros Internos
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Hex ($XX), Bin (%XXXX) o Dec (d)
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => onRegistersFormatChange("hex")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      registersFormat === "hex"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    HEX
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegistersFormatChange("bin")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      registersFormat === "bin"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    BIN
                  </button>
                  <button
                    type="button"
                    onClick={() => onRegistersFormatChange("dec")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      registersFormat === "dec"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    DEC
                  </button>
                </div>
              </div>

              {/* Program Memory Format */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Memoria de Programa
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Hex ($XX), Bin (%XXXX) o Dec (0-255)
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => onProgramMemoryFormatChange("hex")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      programMemoryFormat === "hex"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    HEX
                  </button>
                  <button
                    type="button"
                    onClick={() => onProgramMemoryFormatChange("dec")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      programMemoryFormat === "dec"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    DEC
                  </button>
                  <button
                    type="button"
                    onClick={() => onProgramMemoryFormatChange("bin")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      programMemoryFormat === "bin"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    BIN
                  </button>
                </div>
              </div>

              {/* Data Memory Format */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    Memoria de Datos
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Hex ($XX), Bin (%XXXX) o Dec (0-255)
                  </div>
                </div>
                <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900 p-0.5 text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => onDataMemoryFormatChange("hex")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      dataMemoryFormat === "hex"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    HEX
                  </button>
                  <button
                    type="button"
                    onClick={() => onDataMemoryFormatChange("dec")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      dataMemoryFormat === "dec"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    DEC
                  </button>
                  <button
                    type="button"
                    onClick={() => onDataMemoryFormatChange("bin")}
                    className={`rounded-md px-2 py-1 transition-colors cursor-pointer ${
                      dataMemoryFormat === "bin"
                        ? "bg-amber-400 font-bold text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    BIN
                  </button>
                </div>
              </div>
            </div>
          </section>

          <hr className="border-slate-800" />

          {/* Section 4: Layout Management */}
          <section aria-labelledby="layout-title" className="space-y-3">
            <div>
              <h4
                id="layout-title"
                className="text-sm font-bold text-slate-200"
              >
                Disposición de Paneles
              </h4>
              <p className="text-xs text-slate-400">
                Restaure la organización y tamaños originales de los bloques si
                los ha movido o redimensionado.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border border-slate-800/80 bg-slate-950/40">
              <div className="text-xs text-slate-300">
                Reiniciar orden de tarjetas y ancho del panel al 34%
              </div>
              <button
                type="button"
                onClick={onResetLayout}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                Restablecer Diseño
              </button>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3.5 bg-slate-950/60">
          <div className="text-xs text-slate-400">
            Desarrollado por{" "}
            <span className="font-semibold text-slate-200">Tomás Paternó</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-amber-400 hover:bg-amber-300 px-5 py-2 text-sm font-bold text-slate-950 transition-colors cursor-pointer shadow-xs"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
