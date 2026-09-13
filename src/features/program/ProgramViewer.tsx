import { useEffect, useMemo, useRef, useState } from "react";
import { LoadSummary, parseHexWord } from "../../ipc/emulator";

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

interface ParsedLine {
  originalIndex: number;
  raw: string;
  address: number | null;
  bytes: string[];
  rest: string;
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function parseListingLine(line: string, index: number): ParsedLine {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      originalIndex: index,
      raw: line,
      address: null,
      bytes: [],
      rest: "",
    };
  }

  const tokens = trimmed.split(/\s+/);
  let addr: number | null = null;
  const bytes: string[] = [];
  let restStartIndex = 0;

  // Pattern: "1 2000 86 08" or "2000 86 08"
  if (
    tokens.length >= 2 &&
    /^\d+$/.test(tokens[0]) &&
    /^[0-9a-fA-F]{4}$/.test(tokens[1])
  ) {
    addr = parseHexWord(tokens[1]);
    let i = 2;
    while (i < tokens.length && /^[0-9a-fA-F]{2}$/.test(tokens[i])) {
      bytes.push(tokens[i]);
      i++;
    }
    restStartIndex = i;
  } else if (/^[0-9a-fA-F]{4}$/.test(tokens[0])) {
    addr = parseHexWord(tokens[0]);
    let i = 1;
    while (i < tokens.length && /^[0-9a-fA-F]{2}$/.test(tokens[i])) {
      bytes.push(tokens[i]);
      i++;
    }
    restStartIndex = i;
  }

  const rest = tokens.slice(restStartIndex).join(" ");
  return {
    originalIndex: index,
    raw: line,
    address: addr,
    bytes,
    rest,
  };
}

interface ProgramViewerProps {
  fileName: string | null;
  fileContent: string | null;
  summary: LoadSummary | null;
  pc: number | null;
  onOpenS19: () => void;
  onOpenListing: () => void;
  onLoadSample: (name: string, content: string) => void;
}

export function ProgramViewer({
  fileName,
  fileContent,
  summary,
  pc,
  onOpenS19,
  onOpenListing,
  onLoadSample,
}: ProgramViewerProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const activeLineRef = useRef<HTMLTableRowElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const lines = useMemo(() => {
    if (!fileContent) return [];
    return fileContent
      .split(/\r?\n/)
      .map((line, idx) => parseListingLine(line, idx));
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
    if (autoScroll && activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [activeLineIndex, autoScroll]);

  return (
    <section
      aria-labelledby="program-viewer-title"
      className="flex flex-col h-full rounded-xl border border-slate-800 bg-slate-900/60 shadow-xl overflow-hidden"
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
        className="flex-1 overflow-y-auto font-mono text-sm sm:text-base select-text bg-slate-950/70"
      >
        {lines.length > 0 ? (
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/40 text-xs sm:text-sm text-slate-400 select-none">
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
                >
                  Dir
                </th>
                <th
                  scope="col"
                  className="w-32 px-2.5 py-1.5 text-left font-bold"
                >
                  Bytes
                </th>
                <th scope="col" className="px-2.5 py-1.5 text-left font-bold">
                  Instrucción
                </th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => {
                const isActive = idx === activeLineIndex;
                return (
                  <tr
                    key={idx}
                    ref={isActive ? activeLineRef : null}
                    className={`transition-colors border-b border-slate-900/60 ${
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
                    <td className="px-2.5 py-1.5 font-mono text-amber-400 font-bold text-sm sm:text-base">
                      {line.address !== null
                        ? `$${hexWord(line.address)}`
                        : "—"}
                    </td>

                    {/* Bytes */}
                    <td className="px-2.5 py-1.5 font-mono text-slate-200 text-sm sm:text-base font-semibold">
                      {line.bytes.length > 0 ? line.bytes.join(" ") : ""}
                    </td>

                    {/* Instruction / text */}
                    <td className="px-2.5 py-1.5 text-slate-100 text-sm sm:text-base font-medium">
                      {line.address !== null ? line.rest : line.raw}
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

            <div className="mt-6 border-t border-slate-800/80 pt-4 w-full max-w-xs">
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 mb-2">
                O pruebe un ejemplo integrado:
              </p>
              <div className="flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onLoadSample("programa-2000.lst", SAMPLE_PROGRAM_2000)
                  }
                  className="rounded border border-amber-500/40 bg-slate-900 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                >
                  programa-2000.lst
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onLoadSample("laboratorio-isa.lst", SAMPLE_LAB_ISA)
                  }
                  className="rounded border border-amber-500/40 bg-slate-900 px-2.5 py-1 text-xs text-amber-400 hover:bg-amber-400/10 transition-colors cursor-pointer"
                >
                  laboratorio-isa.lst
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
