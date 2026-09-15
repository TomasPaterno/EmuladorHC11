import { useEffect, useState } from "react";
import { EXAMPLES, ExampleDifficulty, ProgramExample } from "./examples";

interface ExamplesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectExample: (filename: string, code: string) => void;
}

export function ExamplesModal({
  isOpen,
  onClose,
  onSelectExample,
}: ExamplesModalProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    ExampleDifficulty | "Todos"
  >("Todos");
  const [previewExample, setPreviewExample] = useState<ProgramExample | null>(
    null,
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previewExample) {
          setPreviewExample(null);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, previewExample, onClose]);

  if (!isOpen) return null;

  const filteredExamples =
    selectedDifficulty === "Todos"
      ? EXAMPLES
      : EXAMPLES.filter((ex) => ex.difficulty === selectedDifficulty);

  const getDifficultyBadge = (diff: ExampleDifficulty) => {
    switch (diff) {
      case "Principiante":
        return "bg-emerald-500/20 text-emerald-300 border-emerald-500/40";
      case "Intermedio":
        return "bg-amber-500/20 text-amber-300 border-amber-500/40";
      case "Avanzado":
        return "bg-purple-500/20 text-purple-300 border-purple-500/40";
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="examples-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📚</span>
            <div>
              <h3
                id="examples-dialog-title"
                className="text-base font-bold text-slate-100 tracking-tight"
              >
                Programas de Ejemplo para Motorola 68HC11
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona un ejercicio según el tema y la dificultad para
                experimentar en el simulador
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Cerrar ventana de ejemplos"
          >
            ✕
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2.5 bg-slate-950/40 border-b border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <span className="text-slate-400 mr-1 text-[11px] uppercase tracking-wider">
              Dificultad:
            </span>
            {(["Todos", "Principiante", "Intermedio", "Avanzado"] as const).map(
              (diff) => (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setSelectedDifficulty(diff)}
                  className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer text-xs ${
                    selectedDifficulty === diff
                      ? "bg-amber-400 text-slate-950 font-bold shadow-xs"
                      : "bg-slate-800/70 text-slate-300 hover:bg-slate-700 hover:text-white"
                  }`}
                >
                  {diff}
                </button>
              ),
            )}
          </div>

          <span className="text-xs font-mono text-slate-400">
            {filteredExamples.length} ejemplo
            {filteredExamples.length === 1 ? "" : "s"} disponible
            {filteredExamples.length === 1 ? "" : "s"}
          </span>
        </div>

        {/* Body: Cards List or Preview */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {previewExample ? (
            /* Code Preview View */
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div>
                  <h4 className="font-bold text-slate-200 text-sm">
                    {previewExample.title}
                  </h4>
                  <span className="text-xs text-slate-400 font-mono">
                    {previewExample.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewExample(null)}
                    className="px-3 py-1 rounded text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                  >
                    ← Volver a la lista
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onSelectExample(
                        previewExample.filename,
                        previewExample.code,
                      );
                      onClose();
                    }}
                    className="px-3.5 py-1 rounded text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
                  >
                    Cargar en Simulador ➔
                  </button>
                </div>
              </div>
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 overflow-x-auto max-h-[50vh]">
                {previewExample.code}
              </pre>
            </div>
          ) : (
            /* Cards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredExamples.map((ex) => (
                <div
                  key={ex.id}
                  className="flex flex-col justify-between p-4 rounded-xl border border-slate-800 bg-slate-950/60 hover:border-slate-700 transition-all gap-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getDifficultyBadge(
                          ex.difficulty,
                        )}`}
                      >
                        {ex.difficulty}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        {ex.filename}
                      </span>
                    </div>

                    <h4 className="font-bold text-slate-100 text-sm">
                      {ex.title}
                    </h4>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {ex.summary}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {ex.topics.map((t) => (
                        <span
                          key={t}
                          className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 text-[10px] font-mono"
                        >
                          {t}
                        </span>
                      ))}
                    </div>

                    <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2 rounded border border-slate-800/80 mt-2">
                      <span className="font-semibold text-slate-300">
                        Salida esperada:{" "}
                      </span>
                      {ex.expectedOutput}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/70">
                    <button
                      type="button"
                      onClick={() => setPreviewExample(ex)}
                      className="px-2.5 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors cursor-pointer"
                    >
                      Ver Código
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectExample(ex.filename, ex.code);
                        onClose();
                      }}
                      className="px-3 py-1 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded transition-colors cursor-pointer shadow-xs"
                    >
                      Cargar Ejemplo ➔
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-800 px-6 py-3 bg-slate-950/60 text-xs text-slate-400">
          <span>
            💡 Todos los ejemplos incluyen comentarios detallados para seguir
            con el Paso a Paso.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
