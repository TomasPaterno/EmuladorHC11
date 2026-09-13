import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { CcrViewer } from "./features/cpu/CcrViewer";
import { CpuRegisters } from "./features/cpu/CpuRegisters";
import { LastStepTrace } from "./features/cpu/LastStepTrace";
import { ByteFormat } from "./features/inspector/memoryFormat";
import { DraggableCard } from "./features/layout/DraggableCard";
import { Splitter } from "./features/layout/Splitter";
import { MemorySliceView } from "./features/memory/MemorySliceView";
import { ProgramViewer } from "./features/program/ProgramViewer";
import { updateProgramByte } from "./features/program/programSync";
import { ExecutionToolbar } from "./features/toolbar/ExecutionToolbar";
import { SettingsModal } from "./features/toolbar/SettingsModal";
import {
  CpuSnapshot,
  ExecutionResult,
  IpcError,
  LastStep,
  LoadSummary,
  MemoryView,
  RunInfo,
  alignedRowStart,
  inspectMemory,
  loadListing,
  loadS19,
  parseIpcError,
  reset,
  run,
  step,
  writeMemory,
} from "./ipc/emulator";

const S19_NAME = /\.(s19|srec|mot)$/i;
const LISTING_NAME = /\.(lst|txt)$/i;
const SLICE_BYTE_COUNT = 96;
const DEFAULT_PANEL_WIDTH = 34; // 34% width for the program viewer by default

const DEFAULT_BLOCK_ORDER = [
  "registers",
  "ccr",
  "lastStep",
  "memProgram",
  "memData",
];

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function formatError(error: IpcError) {
  return `${error.code}: ${error.message}`;
}

export function App() {
  const [snapshot, setSnapshot] = useState<CpuSnapshot | null>(null);
  const [lastStep, setLastStep] = useState<LastStep | null>(null);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Layout customization state
  const [filePanelWidth, setFilePanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("hc11_file_panel_width");
      if (saved) {
        const val = Number.parseFloat(saved);
        if (!Number.isNaN(val) && val >= 20 && val <= 65) return val;
      }
    } catch {
      // ignore
    }
    return DEFAULT_PANEL_WIDTH;
  });

  const [blockOrder, setBlockOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("hc11_block_order");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_BLOCK_ORDER.length
        ) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_BLOCK_ORDER;
  });

  const [collapsedBlocks, setCollapsedBlocks] = useState<
    Record<string, boolean>
  >({});
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);

  // Theme Mode (Dark / Light)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const saved = localStorage.getItem("hc11_theme");
      if (saved === "light" || saved === "dark") return saved;
    } catch {
      // ignore
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", theme === "light");
    try {
      localStorage.setItem("hc11_theme", theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Font scale (85% - 135%)
  const [fontScale, setFontScale] = useState<number>(() => {
    try {
      const saved = localStorage.getItem("hc11_font_scale");
      if (saved) {
        const val = Number.parseInt(saved, 10);
        if (!Number.isNaN(val) && val >= 85 && val <= 135) return val;
      }
    } catch {
      // ignore
    }
    return 100;
  });

  useEffect(() => {
    document.documentElement.style.fontSize = `${(fontScale / 100) * 16}px`;
    try {
      localStorage.setItem("hc11_font_scale", String(fontScale));
    } catch {
      // ignore
    }
  }, [fontScale]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  function handleResetLayout() {
    setBlockOrder(DEFAULT_BLOCK_ORDER);
    setFilePanelWidth(DEFAULT_PANEL_WIDTH);
    setCollapsedBlocks({});
    try {
      localStorage.removeItem("hc11_block_order");
      localStorage.removeItem("hc11_file_panel_width");
    } catch {
      // ignore
    }
  }

  // Registers display format (Hex / Bin / Dec)
  const [registersFormat, setRegistersFormat] = useState<"hex" | "bin" | "dec">(
    "hex",
  );

  // Program / Loaded File
  const [programName, setProgramName] = useState<string | null>(null);
  const [programContent, setProgramContent] = useState<string | null>(null);
  const [programSummary, setProgramSummary] = useState<LoadSummary | null>(
    null,
  );

  // Memory Slices
  const [programSliceStart, setProgramSliceStart] = useState<number>(0x2000);
  const [programView, setProgramView] = useState<MemoryView | null>(null);
  const [followPc, setFollowPc] = useState<boolean>(true);

  const [dataSliceStart, setDataSliceStart] = useState<number>(0x0000);
  const [dataView, setDataView] = useState<MemoryView | null>(null);
  const [programByteFormat, setProgramByteFormat] = useState<ByteFormat>("hex");
  const [dataByteFormat, setDataByteFormat] = useState<ByteFormat>("hex");

  // Controls
  const [maxSteps, setMaxSteps] = useState("100");

  // File Inputs
  const s19InputRef = useRef<HTMLInputElement>(null);
  const listingInputRef = useRef<HTMLInputElement>(null);

  // Generation tracking for memory fetches
  const programInspectGen = useRef(0);
  const dataInspectGen = useRef(0);

  const writeSet = useMemo(() => {
    const set = new Set<number>();
    for (const write of lastStep?.writes ?? []) {
      set.add(write.address);
    }
    return set;
  }, [lastStep]);

  async function fetchProgramSlice(start: number) {
    const aligned = alignedRowStart(start);
    const gen = ++programInspectGen.current;
    try {
      const view = await inspectMemory(aligned, SLICE_BYTE_COUNT);
      if (gen === programInspectGen.current) {
        setProgramSliceStart(aligned);
        setProgramView(view);
      }
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    }
  }

  async function fetchDataSlice(start: number) {
    const aligned = alignedRowStart(start);
    const gen = ++dataInspectGen.current;
    try {
      const view = await inspectMemory(aligned, SLICE_BYTE_COUNT);
      if (gen === dataInspectGen.current) {
        setDataSliceStart(aligned);
        setDataView(view);
      }
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    }
  }

  async function handleReset() {
    if (programName && programContent) {
      if (S19_NAME.test(programName)) {
        await loadS19Text(programName, programContent);
      } else {
        await loadListingText(programName, programContent);
      }
      return;
    }

    setBusy(true);
    try {
      const next = await reset();
      setSnapshot(next);
      setLastStep(null);
      setRunInfo(null);
      setError(null);
      const initialProg =
        programSummary?.ranges?.[0]?.start ?? alignedRowStart(next.pc);
      setProgramSliceStart(initialProg);
      await Promise.all([
        fetchProgramSlice(initialProg),
        fetchDataSlice(dataSliceStart),
      ]);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function handleStep() {
    setBusy(true);
    try {
      const windowStart = followPc ? undefined : programSliceStart;
      const result = await step(windowStart);
      applyExecutionResult(result);
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    const limit = Number.parseInt(maxSteps, 10);
    if (Number.isNaN(limit) || limit < 1) {
      setError("El límite de pasos debe ser un número entero mayor a 0.");
      return;
    }
    setBusy(true);
    try {
      const windowStart = followPc ? undefined : programSliceStart;
      const result = await run(limit, windowStart);
      applyExecutionResult(result);
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  function applyExecutionResult(result: ExecutionResult) {
    setSnapshot(result.snapshot);
    setLastStep(result.lastStep);
    setRunInfo(result.run ?? null);

    const targetPc = result.snapshot.pc;
    const progStart = followPc ? alignedRowStart(targetPc) : programSliceStart;

    void Promise.all([
      fetchProgramSlice(progStart),
      fetchDataSlice(dataSliceStart),
    ]);
  }

  async function handleWriteByte(address: number, value: number) {
    setBusy(true);
    try {
      const result = await writeMemory(address, value);
      setSnapshot(result.snapshot);

      // Si el byte modificado forma parte del código cargado, actualizar el listado
      if (programContent) {
        const updated = updateProgramByte(programContent, address, value);
        if (updated && updated !== programContent) {
          setProgramContent(updated);
        }
      }

      await Promise.all([
        fetchProgramSlice(programSliceStart),
        fetchDataSlice(dataSliceStart),
      ]);
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function loadListingText(fileName: string, contents: string) {
    setBusy(true);
    try {
      const result = await loadListing(contents);
      setProgramName(fileName);
      setProgramContent(contents);
      setProgramSummary(result.summary);
      setSnapshot(result.snapshot);
      setLastStep(null);
      setRunInfo(null);
      setFollowPc(true);
      const progStart = alignedRowStart(result.snapshot.pc);
      setProgramSliceStart(progStart);
      await Promise.all([
        fetchProgramSlice(progStart),
        fetchDataSlice(dataSliceStart),
      ]);
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function loadS19Text(fileName: string, contents: string) {
    setBusy(true);
    try {
      const result = await loadS19(contents);
      setProgramName(fileName);
      setProgramContent(contents);
      setProgramSummary(result.summary);
      setSnapshot(result.snapshot);
      setLastStep(null);
      setRunInfo(null);
      setFollowPc(true);
      const start = result.summary.ranges[0]
        ? alignedRowStart(result.summary.ranges[0].start)
        : alignedRowStart(result.snapshot.pc);
      setProgramSliceStart(start);
      await Promise.all([
        fetchProgramSlice(start),
        fetchDataSlice(dataSliceStart),
      ]);
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
    }
  }

  async function onS19Selected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!S19_NAME.test(file.name)) {
      setError(
        "invalid_s19: use un archivo Motorola S19 (.s19, .srec o .mot).",
      );
      return;
    }
    const contents = await file.text();
    await loadS19Text(file.name, contents);
  }

  async function onListingSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!LISTING_NAME.test(file.name)) {
      setError("invalid_listing: use un listado compilado (.lst o .txt).");
      return;
    }
    const contents = await file.text();
    await loadListingText(file.name, contents);
  }

  // Reordering handlers
  function moveBlock(fromIndex: number, toIndex: number) {
    if (toIndex < 0 || toIndex >= blockOrder.length) return;
    const newOrder = [...blockOrder];
    const [moved] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, moved);
    setBlockOrder(newOrder);
    try {
      localStorage.setItem("hc11_block_order", JSON.stringify(newOrder));
    } catch {
      // ignore
    }
  }

  function handleDragStartBlock(id: string) {
    setDraggedBlockId(id);
  }

  function handleDragOverBlock(id: string) {
    if (draggedBlockId && draggedBlockId !== id) {
      setDragOverBlockId(id);
    }
  }

  function handleDropBlock(sourceId: string, targetId: string) {
    setDraggedBlockId(null);
    setDragOverBlockId(null);
    if (!sourceId || sourceId === targetId) return;

    const sourceIndex = blockOrder.indexOf(sourceId);
    const targetIndex = blockOrder.indexOf(targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    moveBlock(sourceIndex, targetIndex);
  }

  function toggleCollapse(id: string) {
    setCollapsedBlocks((curr) => ({
      ...curr,
      [id]: !curr[id],
    }));
  }

  // Initial reset on startup
  useEffect(() => {
    let cancelled = false;
    void reset()
      .then(async (next) => {
        if (cancelled) return;
        setSnapshot(next);
        const pStart = alignedRowStart(next.pc);
        setProgramSliceStart(pStart);
        const [pView, dView] = await Promise.all([
          inspectMemory(pStart, SLICE_BYTE_COUNT),
          inspectMemory(0x0000, SLICE_BYTE_COUNT),
        ]);
        if (!cancelled) {
          setProgramView(pView);
          setDataView(dView);
          setError(null);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(formatError(parseIpcError(cause)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Render individual block by ID
  function renderBlock(id: string) {
    const commonProps = {
      isCollapsed: !!collapsedBlocks[id],
      onToggleCollapse: () => toggleCollapse(id),
      onDragStartBlock: handleDragStartBlock,
      onDragOverBlock: handleDragOverBlock,
      onDropBlock: handleDropBlock,
      isDragOver: dragOverBlockId === id,
      isDragging: draggedBlockId === id,
    };

    switch (id) {
      case "registers":
        return (
          <DraggableCard
            key={id}
            id={id}
            title="Registros Internos"
            badge={snapshot ? `Ciclos: ${snapshot.cycles}` : undefined}
            headerExtra={
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
                {(["hex", "dec", "bin"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setRegistersFormat(fmt)}
                    className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                      registersFormat === fmt
                        ? "bg-amber-400 text-slate-950 shadow-xs"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                    }`}
                    title={`Ver registros en ${fmt === "hex" ? "Hexadecimal" : fmt === "dec" ? "Decimal" : "Binario"}`}
                  >
                    {fmt.toUpperCase()}
                  </button>
                ))}
              </div>
            }
            {...commonProps}
          >
            <CpuRegisters
              snapshot={snapshot}
              recentChanges={lastStep?.registers ?? []}
              format={registersFormat}
              headless
            />
          </DraggableCard>
        );

      case "ccr":
        return (
          <DraggableCard
            key={id}
            id={id}
            title="Registro CCR"
            badge={snapshot ? `$${hexByte(snapshot.ccr)}` : "--"}
            {...commonProps}
          >
            <CcrViewer
              flags={snapshot?.ccrFlags ?? null}
              rawCcr={snapshot?.ccr ?? null}
              recentChanges={lastStep?.ccr ?? []}
              headless
            />
          </DraggableCard>
        );

      case "lastStep":
        return (
          <DraggableCard
            key={id}
            id={id}
            title="Último Paso"
            badge={
              lastStep
                ? `${lastStep.mnemonic} (+${lastStep.cyclesAdded})`
                : undefined
            }
            {...commonProps}
          >
            <LastStepTrace lastStep={lastStep} headless />
          </DraggableCard>
        );

      case "memProgram":
        return (
          <DraggableCard
            key={id}
            id={id}
            title="Memoria de Programa"
            badge={followPc ? "Siguiendo PC" : "Fijada"}
            {...commonProps}
            headerExtra={
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFollowPc(!followPc)}
                  className={`rounded px-2 py-0.5 text-xs font-semibold transition-colors cursor-pointer ${
                    followPc
                      ? "bg-amber-400/20 text-amber-300 border border-amber-500/40"
                      : "bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700"
                  }`}
                  title="Sigue automáticamente al PC en cada instrucción"
                >
                  {followPc ? "● Seguir PC" : "Seguir PC"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFollowPc(false);
                    const firstRange =
                      programSummary?.ranges?.[0]?.start ?? 0x2000;
                    void fetchProgramSlice(firstRange & 0xfff0);
                  }}
                  className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  title="Ir al inicio del programa"
                >
                  Inicio Prog
                </button>
                <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
                  {(["hex", "dec", "bin"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setProgramByteFormat(fmt)}
                      className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                        programByteFormat === fmt
                          ? "bg-amber-400 text-slate-950 shadow-xs"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                      title={`Ver Memoria de Programa en ${fmt === "hex" ? "Hexadecimal" : fmt === "dec" ? "Decimal" : "Binario"}`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <MemorySliceView
              title="Memoria de Programa"
              view={programView}
              pc={snapshot?.pc ?? null}
              writeSet={writeSet}
              format={programByteFormat}
              busy={busy}
              onAddressChange={(addr) => {
                setFollowPc(false);
                void fetchProgramSlice(addr);
              }}
              onWriteByte={(addr, val) => {
                void handleWriteByte(addr, val);
              }}
              headless
              hideTitle
            />
          </DraggableCard>
        );

      case "memData":
        return (
          <DraggableCard
            key={id}
            id={id}
            title="Memoria de Datos"
            {...commonProps}
            headerExtra={
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void fetchDataSlice(0x0000)}
                  className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  title="RAM interna ($0000)"
                >
                  RAM $0000
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      snapshot?.sp !== undefined
                        ? snapshot.sp & 0xfff0
                        : 0x0040;
                    void fetchDataSlice(target);
                  }}
                  className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  title="Puntero de Pila (SP)"
                >
                  Pila SP
                </button>
                <button
                  type="button"
                  onClick={() => void fetchDataSlice(0x1000)}
                  className="rounded border border-slate-700 bg-slate-800 hover:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-300 transition-colors cursor-pointer"
                  title="Registros de control I/O ($1000)"
                >
                  I/O $1000
                </button>
                <div className="inline-flex rounded-md border border-slate-700 bg-slate-900/90 p-0.5 shadow-inner">
                  {(["hex", "dec", "bin"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => setDataByteFormat(fmt)}
                      className={`px-1.5 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer ${
                        dataByteFormat === fmt
                          ? "bg-amber-400 text-slate-950 shadow-xs"
                          : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                      }`}
                      title={`Ver Memoria de Datos en ${fmt === "hex" ? "Hexadecimal" : fmt === "dec" ? "Decimal" : "Binario"}`}
                    >
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            }
          >
            <MemorySliceView
              title="Memoria de Datos"
              view={dataView}
              pc={snapshot?.pc ?? null}
              writeSet={writeSet}
              format={dataByteFormat}
              busy={busy}
              onAddressChange={(addr) => {
                void fetchDataSlice(addr);
              }}
              onWriteByte={(addr, val) => {
                void handleWriteByte(addr, val);
              }}
              headless
              hideTitle
            />
          </DraggableCard>
        );

      default:
        return null;
    }
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden select-none">
      {/* Top Application Toolbar */}
      <ExecutionToolbar
        busy={busy}
        cycles={snapshot?.cycles ?? 0}
        runInfo={runInfo}
        maxSteps={maxSteps}
        onMaxStepsChange={setMaxSteps}
        onReset={() => void handleReset()}
        onStep={() => void handleStep()}
        onRun={() => void handleRun()}
        onOpenS19={() => s19InputRef.current?.click()}
        onOpenListing={() => listingInputRef.current?.click()}
        theme={theme}
        onToggleTheme={() =>
          setTheme((curr) => (curr === "dark" ? "light" : "dark"))
        }
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      {/* Dismissible Error Banner */}
      {error && (
        <div
          role="alert"
          className="flex items-center justify-between border-b border-red-500/40 bg-red-950/70 px-5 py-2 text-xs text-red-200"
        >
          <span>
            <strong>Error:</strong> {error}
          </span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="rounded px-2 py-0.5 font-bold hover:bg-red-900/60 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Split Body: Resizable 2 Columns */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden p-3 gap-0">
        {/* Left Column: Loaded Program / File Viewer */}
        <div
          style={{ width: `${filePanelWidth}%` }}
          className="w-full lg:w-auto h-1/2 lg:h-full flex flex-col overflow-hidden pr-0 lg:pr-1"
        >
          <ProgramViewer
            fileName={programName}
            fileContent={programContent}
            summary={programSummary}
            pc={snapshot?.pc ?? null}
            onOpenS19={() => s19InputRef.current?.click()}
            onOpenListing={() => listingInputRef.current?.click()}
            onLoadSample={(name, content) => {
              void loadListingText(name, content);
            }}
            onWriteByte={handleWriteByte}
            onUpdateProgramContent={(newContent) =>
              setProgramContent(newContent)
            }
          />
        </div>

        {/* Draggable Splitter Divider */}
        <Splitter
          onResize={(newPercent) => {
            setFilePanelWidth(newPercent);
            try {
              localStorage.setItem("hc11_file_panel_width", String(newPercent));
            } catch {
              // ignore
            }
          }}
          onReset={() => {
            setFilePanelWidth(DEFAULT_PANEL_WIDTH);
            try {
              localStorage.removeItem("hc11_file_panel_width");
            } catch {
              // ignore
            }
          }}
        />

        {/* Right Column: Reorderable Draggable Cards */}
        <div
          style={{ width: `${100 - filePanelWidth}%` }}
          className="w-full lg:w-auto flex-1 h-1/2 lg:h-full flex flex-col gap-3 overflow-y-auto pl-0 lg:pl-1 pr-1"
        >
          {blockOrder.map((id) => renderBlock(id))}
        </div>
      </main>

      {/* Hidden File Inputs */}
      <input
        ref={s19InputRef}
        type="file"
        accept=".s19,.srec,.mot,text/plain"
        className="sr-only"
        tabIndex={-1}
        disabled={busy}
        onChange={(e) => void onS19Selected(e)}
        aria-hidden="true"
      />
      <input
        ref={listingInputRef}
        type="file"
        accept=".lst,.txt,text/plain"
        className="sr-only"
        tabIndex={-1}
        disabled={busy}
        onChange={(e) => void onListingSelected(e)}
        aria-hidden="true"
      />

      {/* Settings & Font Customization Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        fontScale={fontScale}
        onFontScaleChange={setFontScale}
        theme={theme}
        onThemeChange={setTheme}
        registersFormat={registersFormat}
        onRegistersFormatChange={setRegistersFormat}
        programMemoryFormat={programByteFormat}
        onProgramMemoryFormatChange={setProgramByteFormat}
        dataMemoryFormat={dataByteFormat}
        onDataMemoryFormatChange={setDataByteFormat}
        onResetLayout={handleResetLayout}
      />
    </div>
  );
}

export default App;
