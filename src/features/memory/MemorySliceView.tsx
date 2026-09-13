import { KeyboardEvent, useMemo, useRef, useState, WheelEvent } from "react";
import { MemoryView } from "../../ipc/emulator";
import {
  ByteFormat,
  formatByte,
  parseByteInput,
} from "../inspector/memoryFormat";

const COLUMNS = 16;

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

interface MemorySliceViewProps {
  title: string;
  badge?: string;
  view: MemoryView | null;
  pc: number | null;
  writeSet: Set<number>;
  format: ByteFormat;
  busy?: boolean;
  onAddressChange: (newStart: number) => void;
  onWriteByte: (address: number, value: number) => void;
  headerControls?: React.ReactNode;
  headless?: boolean;
  hideTitle?: boolean;
}

export function MemorySliceView({
  title,
  badge,
  view,
  pc,
  writeSet,
  format,
  busy = false,
  onAddressChange,
  onWriteByte,
  headerControls,
  headless = false,
  hideTitle = false,
}: MemorySliceViewProps) {
  const [edit, setEdit] = useState<{
    index: number;
    draft: string;
  } | null>(null);

  const [hexInput, setHexInput] = useState("");
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo(
    () => Array.from({ length: COLUMNS }, (_, i) => i),
    [],
  );

  if (!view) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500 italic">
        Cargando región de memoria...
      </div>
    );
  }

  const rowsCount = Math.ceil(view.bytes.length / COLUMNS);

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    if (!view) return;
    event.preventDefault();
    const deltaRows = event.deltaY > 0 ? 1 : -1;
    const nextStart = (view.start + deltaRows * COLUMNS + 0x10000) & 0xffff;
    onAddressChange(nextStart);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!view || edit !== null) return;
    if (event.key === "PageDown") {
      event.preventDefault();
      onAddressChange((view.start + view.bytes.length) & 0xffff);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      onAddressChange((view.start - view.bytes.length + 0x10000) & 0xffff);
    }
  }

  function beginEdit(index: number) {
    if (busy || !view) return;
    setEdit({
      index,
      draft: formatByte(view.bytes[index], format),
    });
  }

  function commitEdit(index: number) {
    if (!edit || !view) return;
    const parsed = parseByteInput(edit.draft, format);
    setEdit(null);
    if (parsed === null) return;
    const address = (view.start + index) & 0xffff;
    if (parsed !== view.bytes[index]) {
      onWriteByte(address, parsed);
    }
  }

  function handleAddressSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = hexInput.trim().replace(/^\$/, "").replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{1,4}$/.test(normalized)) {
      const addr = Number.parseInt(normalized, 16);
      onAddressChange(addr & 0xfff0);
    }
    setIsEditingAddress(false);
  }

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={
        headless
          ? "flex flex-col outline-none"
          : "flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 outline-none focus-within:border-slate-700 transition-colors"
      }
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-800/80 pb-2 mb-1">
        <div className="flex items-center gap-2">
          {!hideTitle && (
            <span className="text-xs font-semibold text-slate-200">
              {title}
            </span>
          )}
          {!hideTitle && badge && (
            <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-amber-300">
              {badge}
            </span>
          )}
          {isEditingAddress ? (
            <form onSubmit={handleAddressSubmit} className="inline-flex">
              <input
                autoFocus
                className="w-16 rounded border border-amber-500 bg-slate-950 px-1 py-0.5 font-mono text-xs text-amber-300 outline-none"
                placeholder={hexWord(view.start)}
                value={hexInput}
                onChange={(e) => setHexInput(e.target.value)}
                onBlur={() => setIsEditingAddress(false)}
              />
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setHexInput(hexWord(view.start));
                setIsEditingAddress(true);
              }}
              className="rounded bg-slate-800 hover:bg-slate-700 px-1.5 py-0.5 font-mono text-xs text-amber-400 transition-colors cursor-pointer"
              title="Haga clic para cambiar dirección"
            >
              ${hexWord(view.start)}
            </button>
          )}
        </div>

        {/* Action Controls & Steppers */}
        <div className="flex items-center gap-1.5">
          {headerControls}

          {/* Up/Down row steppers */}
          <div className="flex items-center border border-slate-800 rounded bg-slate-950/60">
            <button
              type="button"
              onClick={() =>
                onAddressChange((view.start - COLUMNS + 0x10000) & 0xffff)
              }
              className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-l"
              title="Línea anterior (-$10)"
              aria-label="Línea anterior"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onAddressChange((view.start + COLUMNS) & 0xffff)}
              className="px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-r"
              title="Línea siguiente (+$10)"
              aria-label="Línea siguiente"
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Hex Grid Table */}
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs select-none">
          <thead>
            <tr className="border-b border-slate-800/60 text-slate-500">
              <th
                scope="col"
                className="py-1 text-left font-medium text-[11px] pr-2"
              >
                Dir
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="py-1 text-center font-normal text-[10px] w-6"
                >
                  {hexByte(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rowsCount }, (_, row) => {
              const rowAddr = (view.start + row * COLUMNS) & 0xffff;
              return (
                <tr key={rowAddr} className="hover:bg-slate-800/30">
                  <th
                    scope="row"
                    className="py-1 text-left font-normal text-slate-500 pr-2 select-text"
                  >
                    ${hexWord(rowAddr)}
                  </th>
                  {columns.map((col) => {
                    const idx = row * COLUMNS + col;
                    if (idx >= view.bytes.length) {
                      return <td key={col} />;
                    }
                    const addr = (view.start + idx) & 0xffff;
                    const val = view.bytes[idx];
                    const isPc = pc === addr;
                    const isWrite = writeSet.has(addr);
                    const isEditing = edit?.index === idx;

                    return (
                      <td key={col} className="p-0.5 text-center">
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full rounded bg-slate-950 text-center font-bold text-amber-300 outline-none ring-1 ring-amber-400"
                            value={edit.draft}
                            onChange={(e) =>
                              setEdit({ index: idx, draft: e.target.value })
                            }
                            onBlur={() => commitEdit(idx)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitEdit(idx);
                              } else if (e.key === "Escape") {
                                e.preventDefault();
                                setEdit(null);
                              }
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            onDoubleClick={() => beginEdit(idx)}
                            className={`w-full rounded px-0.5 py-0.5 text-center transition-all ${
                              isPc
                                ? "bg-amber-400 font-bold text-slate-950 shadow-sm"
                                : isWrite
                                  ? "bg-cyan-600 font-bold text-slate-50 ring-1 ring-cyan-400"
                                  : "text-slate-300 hover:bg-slate-800 hover:text-white"
                            }`}
                            title={`$${hexWord(addr)}: ${formatByte(val, format)}${
                              isPc ? " (PC)" : ""
                            }${isWrite ? " (Escrito)" : ""} - Doble clic para editar`}
                          >
                            {formatByte(val, format)}
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
