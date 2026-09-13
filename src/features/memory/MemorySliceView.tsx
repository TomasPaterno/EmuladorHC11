import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MemoryView } from "../../ipc/emulator";
import { ByteFormat, parseByteInput } from "../inspector/memoryFormat";

const COLUMNS = 16;

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function formatDisplayByte(value: number, format: ByteFormat): string {
  if (format === "bin") {
    const raw = value.toString(2).padStart(8, "0");
    return `${raw.slice(0, 4)} ${raw.slice(4)}`;
  }
  if (format === "dec") {
    return value.toString(10).padStart(3, " ");
  }
  return hexByte(value);
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

  const [jumpInput, setJumpInput] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const accumulatedDeltaRef = useRef(0);
  const targetAddressRef = useRef(view?.start ?? 0x2000);
  const debounceTimerRef = useRef<number | null>(null);
  const onAddressChangeRef = useRef(onAddressChange);

  useEffect(() => {
    onAddressChangeRef.current = onAddressChange;
  }, [onAddressChange]);

  // Synchronize target address when view updates externally
  useEffect(() => {
    if (view) {
      targetAddressRef.current = view.start;
    }
  }, [view]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current !== null) {
        window.clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const columns = useMemo(
    () => Array.from({ length: COLUMNS }, (_, i) => i),
    [],
  );

  // Wheel listener: intercepts vertical scrolling on the memory card to step rows
  // without triggering Chromium's auto-horizontal scroll or freezing the view.
  const onWheelNative = useCallback((e: globalThis.WheelEvent) => {
    // If vertical scroll gesture: intercept and advance rows
    if (Math.abs(e.deltaY) >= Math.abs(e.deltaX) && Math.abs(e.deltaY) > 1) {
      e.preventDefault();
      e.stopPropagation();

      accumulatedDeltaRef.current += e.deltaY;
      // 35 pixels of wheel delta per memory row (16 bytes)
      const ROW_STEP_DELTA = 35;
      const rows = Math.trunc(accumulatedDeltaRef.current / ROW_STEP_DELTA);

      if (rows !== 0) {
        accumulatedDeltaRef.current -= rows * ROW_STEP_DELTA;
        const newStart =
          (targetAddressRef.current + rows * COLUMNS + 0x10000) & 0xffff;
        targetAddressRef.current = newStart;

        if (debounceTimerRef.current !== null) {
          window.clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = window.setTimeout(() => {
          debounceTimerRef.current = null;
          onAddressChangeRef.current(targetAddressRef.current);
        }, 20);
      }
    }
    // If horizontal scroll gesture (deltaX > deltaY), let browser scroll table horizontally
  }, []);

  // Callback ref ensures listener is attached as soon as the DOM node renders
  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (containerRef.current) {
        containerRef.current.removeEventListener("wheel", onWheelNative);
      }
      containerRef.current = node;
      if (node) {
        node.addEventListener("wheel", onWheelNative, { passive: false });
      }
    },
    [onWheelNative],
  );

  if (!view) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs text-slate-500 italic">
        Cargando región de memoria...
      </div>
    );
  }

  const rowsCount = Math.ceil(view.bytes.length / COLUMNS);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!view || edit !== null) return;
    if (event.key === "PageDown") {
      event.preventDefault();
      onAddressChange((view.start + view.bytes.length) & 0xffff);
    } else if (event.key === "PageUp") {
      event.preventDefault();
      onAddressChange((view.start - view.bytes.length + 0x10000) & 0xffff);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      onAddressChange((view.start + COLUMNS) & 0xffff);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      onAddressChange((view.start - COLUMNS + 0x10000) & 0xffff);
    }
  }

  function beginEdit(index: number) {
    if (busy || !view) return;
    setEdit({
      index,
      draft: hexByte(view.bytes[index]),
    });
  }

  function commitEdit(index: number) {
    if (!edit || !view) return;
    const parsed = parseByteInput(edit.draft.replace(/\s+/g, ""), format);
    setEdit(null);
    if (parsed === null) return;
    const address = (view.start + index) & 0xffff;
    if (parsed !== view.bytes[index]) {
      onWriteByte(address, parsed);
    }
  }

  function handleJumpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = jumpInput.trim().replace(/^\$/, "").replace(/^0x/i, "");
    if (/^[0-9a-fA-F]{1,4}$/.test(normalized)) {
      const addr = Number.parseInt(normalized, 16);
      onAddressChange(addr & 0xfff0);
      setJumpInput("");
    }
  }

  return (
    <div
      ref={setContainerRef}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className={
        headless
          ? "flex flex-col outline-none w-full"
          : "flex flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-2.5 outline-none focus-within:border-slate-700 transition-colors w-full"
      }
    >
      {/* Header Bar: Address jump, quick steppers, page jumps */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2 mb-2">
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

          {/* Jump to address input */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1">
            <div className="flex items-center rounded border border-slate-700 bg-slate-950 px-2 py-0.5 focus-within:border-amber-400">
              <span className="text-amber-400 font-mono text-sm font-bold select-none mr-0.5">
                $
              </span>
              <input
                className="w-16 bg-transparent font-mono text-sm font-bold text-amber-300 outline-none uppercase"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                placeholder={hexWord(view.start)}
                title="Escriba una dirección hex (ej. 0000, 2000, 3000) y presione Enter o Ir"
              />
            </div>
            <button
              type="submit"
              className="rounded bg-slate-800 hover:bg-slate-700 px-2.5 py-0.5 text-xs sm:text-sm font-semibold text-slate-200 transition-colors cursor-pointer"
              title="Saltar a la dirección ingresada"
            >
              Ir
            </button>
          </form>

          {/* Large distance jump buttons */}
          <div className="flex items-center gap-1 font-mono text-xs">
            <button
              type="button"
              onClick={() =>
                onAddressChange((view.start - 0x100 + 0x10000) & 0xffff)
              }
              className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 font-bold text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
              title="Retroceder 256 bytes (-$100)"
            >
              -$100
            </button>
            <button
              type="button"
              onClick={() => onAddressChange((view.start + 0x100) & 0xffff)}
              className="rounded bg-slate-800 hover:bg-slate-700 px-2 py-0.5 font-bold text-slate-300 hover:text-slate-100 transition-colors cursor-pointer"
              title="Avanzar 256 bytes (+$100)"
            >
              +$100
            </button>
          </div>
        </div>

        {/* Action Controls & Steppers */}
        <div className="flex items-center gap-2">
          {headerControls}

          {/* Up/Down row steppers */}
          <div className="flex items-center border border-slate-800 rounded bg-slate-950/60">
            <button
              type="button"
              onClick={() =>
                onAddressChange((view.start - COLUMNS + 0x10000) & 0xffff)
              }
              className="px-2 py-0.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-l cursor-pointer font-bold"
              title="Fila anterior (-$10)"
              aria-label="Fila anterior"
            >
              ▲
            </button>
            <button
              type="button"
              onClick={() => onAddressChange((view.start + COLUMNS) & 0xffff)}
              className="px-2 py-0.5 text-xs text-slate-300 hover:text-slate-100 hover:bg-slate-800 rounded-r cursor-pointer font-bold"
              title="Fila siguiente (+$10)"
              aria-label="Fila siguiente"
            >
              ▼
            </button>
          </div>
        </div>
      </div>

      {/* Hex / Bin Grid Table with visible borders and distinct boxes for every cell */}
      <div className="w-full overflow-x-auto select-none">
        <table
          className={`w-full border-separate font-mono select-none ${
            format === "bin"
              ? "min-w-[1460px] border-spacing-x-2 border-spacing-y-1.5 text-xs sm:text-sm"
              : "border-spacing-x-1.5 border-spacing-y-1 text-sm sm:text-base"
          }`}
        >
          <thead>
            <tr className="text-slate-400">
              <th
                scope="col"
                className="w-20 px-1.5 py-1 text-left font-bold text-xs sm:text-sm text-slate-400"
              >
                Dir
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={`py-1 text-center font-bold text-xs sm:text-sm text-slate-400 ${
                    format === "bin" ? "w-24 min-w-[84px]" : "min-w-[34px]"
                  }`}
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
                <tr key={rowAddr} className="hover:bg-slate-800/20">
                  <th
                    scope="row"
                    className="w-20 px-1.5 py-1 text-left font-mono font-bold text-sm sm:text-base text-slate-400 select-text"
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
                      <td key={col} className="p-0 text-center">
                        {isEditing ? (
                          <input
                            autoFocus
                            className="w-full rounded bg-slate-950 px-1 py-0.5 text-center font-bold text-amber-300 outline-none ring-1 ring-amber-400 text-sm sm:text-base"
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
                            className={`w-full rounded-md border px-1 py-1 text-center transition-all cursor-pointer shadow-xs ${
                              isPc
                                ? "border-amber-400 bg-amber-400 font-black text-slate-950 shadow-sm"
                                : isWrite
                                  ? "border-cyan-400 bg-cyan-600 font-black text-white ring-1 ring-cyan-400"
                                  : "border-slate-800 bg-slate-950/80 text-slate-100 hover:border-amber-400/60 hover:bg-slate-800/80 font-bold"
                            } ${
                              format === "bin"
                                ? "min-w-[84px] text-xs sm:text-sm tracking-tight"
                                : format === "dec"
                                  ? "min-w-[38px] text-xs sm:text-sm tracking-tight"
                                  : "min-w-[34px] text-sm sm:text-base tracking-normal"
                            }`}
                            title={`$${hexWord(addr)}: ${formatDisplayByte(
                              val,
                              format,
                            )} (dec: ${val})${isPc ? " (PC)" : ""}${
                              isWrite ? " (Escrito)" : ""
                            } - Doble clic para editar`}
                          >
                            {format === "bin" ? (
                              <span className="inline-flex items-center justify-center gap-1 font-mono tracking-wider font-bold">
                                <span>
                                  {val.toString(2).padStart(8, "0").slice(0, 4)}
                                </span>
                                <span className="text-slate-500 font-bold">
                                  ·
                                </span>
                                <span>
                                  {val.toString(2).padStart(8, "0").slice(4)}
                                </span>
                              </span>
                            ) : (
                              formatDisplayByte(val, format)
                            )}
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
