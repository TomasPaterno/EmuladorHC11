import { FormEvent, useState } from "react";
import { parseHexBytes, parseHexWord } from "../../ipc/emulator";

interface ManualLoadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (start: number, data: number[]) => Promise<void>;
  busy?: boolean;
}

export function ManualLoadModal({
  isOpen,
  onClose,
  onLoad,
  busy = false,
}: ManualLoadModalProps) {
  const [startInput, setStartInput] = useState("0000");
  const [dataInput, setDataInput] = useState("86 55 4F");
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const start = parseHexWord(startInput);
    const data = parseHexBytes(dataInput);
    if (start === null || data === null) {
      setError(
        "Use una dirección de 16 bits (ej. 0000) y bytes hex (ej. 86 55).",
      );
      return;
    }
    if (data.length === 0) {
      setError("Ingrese al menos un byte para cargar.");
      return;
    }
    try {
      await onLoad(start, data);
      onClose();
    } catch (err: unknown) {
      setError(String(err));
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-load-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3
            id="manual-load-title"
            className="text-base font-bold text-slate-100"
          >
            Cargar Bytes Manualmente
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:text-slate-200"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          {error && (
            <p className="rounded bg-red-950/60 border border-red-500/50 p-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Dirección inicial (Hex 16 bits):
            </label>
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              placeholder="ej. 0000 o 2000"
              spellCheck={false}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Bytes hexadecimales:
            </label>
            <input
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-mono text-xs text-slate-100 outline-none focus:border-amber-400"
              value={dataInput}
              onChange={(e) => setDataInput(e.target.value)}
              placeholder="ej. 86 55 4F"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Ejemplo: <code>86 55 4F</code> para <code>LDAA #$55</code> y{" "}
              <code>CLRA</code>.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded bg-amber-400 hover:bg-amber-300 px-4 py-1.5 text-xs font-bold text-slate-950 disabled:opacity-50 cursor-pointer"
            >
              {busy ? "Cargando..." : "Cargar en Memoria"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
