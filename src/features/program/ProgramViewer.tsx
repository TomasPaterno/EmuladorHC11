import { useEffect, useMemo, useRef, useState } from "react";
import { LoadSummary } from "../../ipc/emulator";
import {
  parseCodeLine,
  updateProgramLineBytes,
  updateProgramLineAddress,
} from "./programSync";
import { disassembleHexStrings } from "./disassembler";
import { ExamplesModal } from "./ExamplesModal";
import { EXAMPLES } from "./examples";

export const SAMPLE_PROGRAM_2000 = `1 0000
2 2000
3 2000 86 08
4 2002 97 60
5 2004 CE 30 00
6 2007 4F
7 2008 4C
8 2009 A7 00
9 200B A7 01
10 200D A6 00
11 200F E6 01
12 2011 1B
13 2012 A7 02
14 2014 08
15 2015 7A 00 60
16 2018 26 F3
17 201A 7E 20 1A`;

export const SAMPLE_LAB_ISA = `1 0000
2 2000
3 2000 18 CE 30 00
4 2004 86 05
5 2006 18 A7 00
6 2009 7C 30 00
7 200C C6 03
8 200E 3D
9 200F 89 01
10 2011 14 40 80
11 2014 13 40 01 03
12 2018 01
13 2019 01
14 201A 01
15 201B 7E 20 1B`;

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

interface ProgramViewerProps {
  fileName: string | null;
  fileContent: string | null;
  summary: LoadSummary | null;
  pc: number | null;
  onOpenS19: () => void;
  onOpenListing: () => void;
  onLoadSample: (name: string, content: string) => void;
  onWriteByte?: (address: number, value: number) => Promise<void>;
  onWriteBytes?: (
    writes: { address: number; value: number }[],
    newContent?: string,
  ) => Promise<void>;
  onUpdateProgramContent?: (newContent: string) => void;
}

interface EditingCell {
  lineIndex: number;
  field: "byte" | "address";
  byteIndex?: number;
  initialValue: string;
}

export function ProgramViewer({
  fileName,
  fileContent,
  summary,
  pc,
  onOpenS19,
  onOpenListing,
  onLoadSample,
  onWriteByte,
  onWriteBytes,
  onUpdateProgramContent,
}: ProgramViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const activeLineRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const [isExamplesModalOpen, setIsExamplesModalOpen] = useState(false);

  useEffect(() => {
    if (editing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editing]);

  const lines = useMemo(() => {
    if (!fileContent) return [];
    return fileContent
      .split(/\r?\n/)
      .map((line, idx) => parseCodeLine(line, idx));
  }, [fileContent]);

  // Find line corresponding to current PC
  const activeLineIndex = useMemo(() => {
    if (pc === null || lines.length === 0) return -1;
    // Exact match first
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].address === pc && lines[i].bytes.length > 0) {
        return i;
      }
    }
    // Range match
    for (let i = 0; i < lines.length; i++) {
      const curr = lines[i];
      if (curr.address !== null && curr.bytes.length > 0) {
        const next = lines
          .slice(i + 1)
          .find((l) => l.address !== null && l.bytes.length > 0);
        const endAddr = next?.address ?? curr.address + curr.bytes.length;
        if (pc >= curr.address && pc < endAddr) {
          return i;
        }
      }
    }
    return -1;
  }, [lines, pc]);

  useEffect(() => {
    if (autoScroll && activeLineRef.current && scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const row = activeLineRef.current;
      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      if (rowRect.top < containerRect.top + 32) {
        container.scrollTop -= containerRect.top + 32 - rowRect.top;
      } else if (rowRect.bottom > containerRect.bottom - 10) {
        container.scrollTop += rowRect.bottom - containerRect.bottom + 32;
      }
    }
  }, [activeLineIndex, autoScroll]);

  async function handleCommit() {
    if (!editing || !fileContent) {
      setEditing(null);
      return;
    }

    const { lineIndex, field, byteIndex } = editing;
    const targetLine = lines[lineIndex];
    if (!targetLine) {
      setEditing(null);
      return;
    }

    const trimmed = editValue.trim();

    try {
      if (
        field === "byte" &&
        typeof byteIndex === "number" &&
        targetLine.address !== null
      ) {
        const hexClean = trimmed.replace(/^(\$|0x)/i, "");
        let parsedVal = parseInt(hexClean, 16);
        if (Number.isNaN(parsedVal)) {
          parsedVal = parseInt(trimmed, 10);
        }
        if (!Number.isNaN(parsedVal) && parsedVal >= 0 && parsedVal <= 255) {
          const updatedHex = (parsedVal & 0xff)
            .toString(16)
            .toUpperCase()
            .padStart(2, "0");
          const currentBytes = [...targetLine.bytes];
          currentBytes[byteIndex] = updatedHex;
          const res = updateProgramLineBytes(
            fileContent,
            lineIndex,
            currentBytes,
          );
          if (res) {
            if (onWriteBytes) {
              await onWriteBytes(res.writes, res.updatedContent);
            } else {
              const targetAddr = targetLine.address + byteIndex;
              await onWriteByte?.(targetAddr, parsedVal);
              onUpdateProgramContent?.(res.updatedContent);
            }
          }
        }
      } else if (field === "address" && targetLine.address !== null) {
        const hexClean = trimmed.replace(/^(\$|0x)/i, "");
        const parsedAddr = parseInt(hexClean, 16);
        if (
          !Number.isNaN(parsedAddr) &&
          parsedAddr >= 0 &&
          parsedAddr <= 0xffff
        ) {
          const updated = updateProgramLineAddress(
            fileContent,
            lineIndex,
            parsedAddr,
          );
          onUpdateProgramContent?.(updated);
        }
      }
    } catch {
      // Ignorar errores en edición manual
    } finally {
      setEditing(null);
    }
  }

  return (
    <section
      aria-labelledby="program-viewer-title"
      className="flex flex-col h-full min-h-0 rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden"
    >
      {/* File Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-900/90 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-400/20 text-amber-300 font-mono text-xs font-bold">
            &lt;/&gt;
          </div>
          <div>
            <h2
              id="program-viewer-title"
              className="text-sm font-bold text-slate-100 flex items-center gap-2"
            >
              {fileName || "Archivo de Programa"}
              {fileName && (
                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300">
                  Cargado
                </span>
              )}
              {fileContent && pc !== null && activeLineIndex === -1 && (
                <span
                  className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[11px] font-mono font-medium text-amber-300 flex items-center gap-1.5"
                  title={`El Program Counter (PC) se encuentra en la dirección $${hexWord(pc)}, fuera de las instrucciones del archivo cargado.`}
                >
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                  PC: ${hexWord(pc)} (fuera de rango)
                </span>
              )}
            </h2>
            {summary ? (
              <p className="text-xs sm:text-sm text-slate-300 font-mono font-medium">
                {summary.bytesLoaded} bytes · {summary.recordCount} registros ·{" "}
                {summary.ranges.length > 0
                  ? summary.ranges
                      .map((r) => `$${hexWord(r.start)}-$${hexWord(r.end)}`)
                      .join(", ")
                  : "sin rangos"}
              </p>
            ) : (
              <p className="text-xs text-slate-400">Ningún archivo cargado</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {fileContent && (
            <button
              type="button"
              onClick={() => setAutoScroll(!autoScroll)}
              className={`rounded px-2 py-1 text-xs font-medium transition-colors cursor-pointer ${
                autoScroll
                  ? "bg-amber-400/20 text-amber-300 border border-amber-500/30"
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              }`}
              title="Mantiene la instrucción actual centrada al desplazarse la CPU"
            >
              {autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsExamplesModalOpen(true)}
            className="rounded border border-purple-400/60 bg-purple-500/20 hover:bg-purple-500/30 px-2.5 py-1 text-xs font-semibold text-purple-300 transition-colors cursor-pointer flex items-center gap-1.5"
            title="Abrir catálogo de programas de ejemplo pedagógicos"
          >
            <span>📚</span> Ejemplos
          </button>
          <button
            type="button"
            onClick={onOpenListing}
            className="rounded border border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20 px-2.5 py-1 text-xs font-semibold text-amber-300 transition-colors cursor-pointer"
          >
            Abrir Listado
          </button>
          <button
            type="button"
            onClick={onOpenS19}
            className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            Abrir S19
          </button>
        </div>
      </div>

      {/* Main Code Body */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-auto font-mono text-sm sm:text-base select-text bg-slate-950/70 scrollbar-thin"
      >
        {lines.length > 0 ? (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-800 shadow-xs">
              <tr className="bg-slate-900 text-xs sm:text-sm text-slate-400 select-none">
                <th
                  scope="col"
                  className="w-14 px-2.5 py-1.5 text-right font-bold text-slate-300 border-r border-slate-800/80"
                >
                  #
                </th>
                <th
                  scope="col"
                  className="w-8 px-1 py-1.5 text-center font-bold"
                >
                  PC
                </th>
                <th
                  scope="col"
                  className="w-24 px-2.5 py-1.5 text-left font-bold"
                  title="Doble clic para editar dirección"
                >
                  Dir
                </th>
                <th
                  scope="col"
                  className="w-48 min-w-[190px] px-2.5 py-1.5 text-left font-bold whitespace-nowrap"
                  title="Doble clic en un byte para editar"
                >
                  Bytes
                </th>
                <th
                  scope="col"
                  className="px-2.5 py-1.5 text-left font-bold whitespace-nowrap"
                  title="Instrucción en ensamblador Motorola 68HC11 (modo informativo)"
                >
                  Instrucción
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                const isEditingAddr =
                  editing?.lineIndex === idx && editing.field === "address";

                const firstByte = line.bytes[0]?.toUpperCase();
                const opcodeLen =
                  firstByte === "18" || firstByte === "1A" || firstByte === "CD"
                    ? 2
                    : 1;

                return (
                  <tr
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={`transition-colors border-b border-slate-900/60 whitespace-nowrap ${
                      isActive
                        ? "bg-amber-400/20 text-amber-100 font-bold border-y border-amber-500/50 shadow-inner"
                        : "hover:bg-slate-900/40 text-slate-200"
                    }`}
                  >
                    {/* Line number */}
                    <td className="px-2.5 py-1.5 text-right font-mono text-sm sm:text-base font-bold text-slate-300 select-none bg-slate-950/50 border-r border-slate-800/80">
                      {idx + 1}
                    </td>

                    {/* PC Indicator */}
                    <td className="px-1 py-1.5 text-center select-none">
                      {isActive ? (
                        <span className="inline-block text-amber-400 text-base font-black animate-pulse">
                          ▶
                        </span>
                      ) : null}
                    </td>

                    {/* Address */}
                    <td
                      onDoubleClick={() => {
                        if (line.address !== null) {
                          setEditing({
                            lineIndex: idx,
                            field: "address",
                            initialValue: hexWord(line.address),
                          });
                          setEditValue(hexWord(line.address));
                        }
                      }}
                      title={
                        line.address !== null
                          ? "Doble clic para editar dirección"
                          : undefined
                      }
                      className="px-2.5 py-1.5 font-mono text-amber-400 font-bold text-sm sm:text-base cursor-pointer hover:bg-amber-400/10 rounded transition-colors"
                    >
                      {isEditingAddr ? (
                        <input
                          ref={editInputRef}
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleCommit();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          onBlur={() => void handleCommit()}
                          className="w-20 rounded bg-slate-800 border border-amber-400 px-1 py-0.5 text-xs sm:text-sm font-mono text-amber-300 font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                      ) : line.address !== null ? (
                        `$${hexWord(line.address)}`
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Bytes */}
                    <td
                      title={
                        line.bytes.length > 0
                          ? "Doble clic en un byte para editarlo"
                          : undefined
                      }
                      className="w-48 min-w-[190px] px-2.5 py-1.5 font-mono text-slate-200 text-sm sm:text-base font-semibold whitespace-nowrap"
                    >
                      {line.bytes.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-nowrap">
                          {line.bytes.map((byteHex, bIdx) => {
                            const isThisByteEditing =
                              editing?.lineIndex === idx &&
                              editing.field === "byte" &&
                              editing.byteIndex === bIdx;

                            if (isThisByteEditing) {
                              return (
                                <input
                                  key={bIdx}
                                  ref={editInputRef}
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void handleCommit();
                                    if (e.key === "Escape") setEditing(null);
                                  }}
                                  onBlur={() => void handleCommit()}
                                  className="w-10 rounded bg-slate-950 border border-amber-400 px-1 py-0.5 text-xs sm:text-sm font-mono text-amber-300 text-center font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                                />
                              );
                            }

                            const byteAddr =
                              line.address !== null
                                ? line.address + bIdx
                                : null;
                            const isOpcode = bIdx < opcodeLen;
                            const paramNum = bIdx - opcodeLen + 1;

                            return (
                              <span
                                key={bIdx}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  if (line.address !== null) {
                                    setEditing({
                                      lineIndex: idx,
                                      field: "byte",
                                      byteIndex: bIdx,
                                      initialValue: byteHex,
                                    });
                                    setEditValue(byteHex);
                                  }
                                }}
                                title={
                                  isOpcode
                                    ? `Opcode: $${byteHex}${byteAddr !== null ? ` en $${hexWord(byteAddr)}` : ""} (Doble clic para editar)`
                                    : `Parámetro #${paramNum}: $${byteHex}${byteAddr !== null ? ` en $${hexWord(byteAddr)}` : ""} (Doble clic para editar)`
                                }
                                className={`inline-block px-1.5 py-0.5 rounded cursor-pointer border font-bold transition-all select-none text-xs sm:text-sm bg-transparent ${
                                  isOpcode
                                    ? "border-amber-400 text-amber-400 hover:bg-amber-400/10"
                                    : "border-cyan-400 text-cyan-400 hover:bg-cyan-400/10"
                                }`}
                              >
                                {byteHex}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        ""
                      )}
                    </td>

                    {/* Instruction / text (informativo / desensamblado automático) */}
                    <td
                      className="px-2.5 py-1.5 text-slate-100 text-sm sm:text-base font-medium select-text whitespace-nowrap"
                      title={
                        line.bytes.length > 0
                          ? "Instrucción en ensamblador traducida a partir de los bytes (modo informativo)"
                          : undefined
                      }
                    >
                      {line.bytes.length > 0 ? (
                        (() => {
                          const disasm = disassembleHexStrings(
                            line.bytes,
                            line.address,
                          );
                          return (
                            <div className="flex items-center flex-nowrap gap-x-2 whitespace-nowrap">
                              <span
                                className="font-mono font-bold text-amber-300 text-sm sm:text-base shrink-0"
                                title={`Nemónico: ${disasm.mnemonic} · Modo: ${disasm.mode}`}
                              >
                                {disasm.mnemonic}
                              </span>
                              {disasm.operands && (
                                <span
                                  className="font-mono font-semibold text-cyan-300 text-sm sm:text-base shrink-0"
                                  title={`Operandos / Parámetros: ${disasm.operands}`}
                                >
                                  {disasm.operands}
                                </span>
                              )}
                              {!disasm.isComplete && (
                                <span
                                  className="rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[10px] font-sans font-medium text-amber-300 italic shrink-0"
                                  title={`La instrucción espera ${disasm.expectedParamBytes} parámetro(s) pero tiene ${disasm.actualParamBytes}`}
                                >
                                  incompleto ({disasm.actualParamBytes}/
                                  {disasm.expectedParamBytes} parám)
                                </span>
                              )}
                              {line.rest &&
                                (line.rest.trim().startsWith(";") ||
                                  line.rest.trim().startsWith("*")) && (
                                  <span className="text-slate-400 font-mono text-xs italic ml-1.5 opacity-80 shrink-0">
                                    {line.rest.trim()}
                                  </span>
                                )}
                            </div>
                          );
                        })()
                      ) : line.address !== null ? (
                        <span className="text-slate-500 font-mono text-xs">
                          {line.rest || "—"}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-mono text-xs">
                          {line.raw}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center p-8 text-center h-full">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-900 border border-slate-800 text-amber-400 text-2xl mb-3">
              📁
            </div>
            <h3 className="text-base font-semibold text-slate-200">
              Ningún archivo cargado
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-400">
              Cargue un archivo Motorola S19 (<code>.s19</code>,{" "}
              <code>.srec</code>) o un listado ensamblado (<code>.lst</code>,{" "}
              <code>.txt</code>) para ver su código e instrucciones.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={onOpenListing}
                className="rounded-lg bg-amber-400 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-300 transition-colors cursor-pointer"
              >
                Cargar Listado (.lst)
              </button>
              <button
                type="button"
                onClick={onOpenS19}
                className="rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition-colors cursor-pointer"
              >
                Cargar S19 (.s19)
              </button>
            </div>

            <div className="mt-6 border-t border-slate-800/80 pt-4 w-full max-w-sm">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400 mb-2.5">
                O pruebe un programa pedagógico integrado:
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setIsExamplesModalOpen(true)}
                  className="w-full rounded-lg border border-purple-400/50 bg-purple-500/15 hover:bg-purple-500/25 px-3 py-2 text-xs font-bold text-purple-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>📚</span> Explorar Catálogo de Ejemplos (
                  {EXAMPLES.length} disponibles)
                </button>
                <div className="grid grid-cols-2 gap-1.5 pt-1">
                  {EXAMPLES.slice(0, 4).map((ex) => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => onLoadSample(ex.filename, ex.code)}
                      className="rounded border border-slate-700/80 bg-slate-900/90 hover:bg-slate-800 px-2 py-1.5 text-[11px] font-medium text-slate-300 hover:text-amber-300 transition-colors cursor-pointer text-left truncate"
                      title={ex.title}
                    >
                      ▶ {ex.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ExamplesModal
        isOpen={isExamplesModalOpen}
        onClose={() => setIsExamplesModalOpen(false)}
        onSelectExample={onLoadSample}
      />
    </section>
  );
}
