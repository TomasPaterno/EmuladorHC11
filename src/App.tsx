import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import "./App.css";
import { LastStepPanel, MemoryHex } from "./features/inspector/MemoryHex";
import { ByteFormat } from "./features/inspector/memoryFormat";
import {
  CpuSnapshot,
  ExecutionResult,
  IpcError,
  LastStep,
  LoadSummary,
  MemoryView,
  RunInfo,
  alignedRowStart,
  alignedViewStart,
  inspectMemory,
  loadBytes,
  loadListing,
  loadS19,
  parseHexBytes,
  parseHexWord,
  parseIpcError,
  reset,
  run,
  step,
  writeMemory,
} from "./ipc/emulator";

const S19_NAME = /\.(s19|srec|mot)$/i;
const LISTING_NAME = /\.(lst|txt)$/i;

type MemoryOrigin = "pc" | "s19" | "hex";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

function App() {
  const [snapshot, setSnapshot] = useState<CpuSnapshot | null>(null);
  const [memoryView, setMemoryView] = useState<MemoryView | null>(null);
  const [lastStep, setLastStep] = useState<LastStep | null>(null);
  const [runInfo, setRunInfo] = useState<RunInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [startInput, setStartInput] = useState("0000");
  const [dataInput, setDataInput] = useState("01");
  const [programName, setProgramName] = useState<string | null>(null);
  const [programSummary, setProgramSummary] = useState<LoadSummary | null>(
    null,
  );
  const [origin, setOrigin] = useState<MemoryOrigin>("pc");
  const [hexOrigin, setHexOrigin] = useState("0000");
  const [byteFormat, setByteFormat] = useState<ByteFormat>("hex");
  const [maxSteps, setMaxSteps] = useState("100");
  const [cursor, setCursor] = useState(0);
  const inspectGeneration = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listingInputRef = useRef<HTMLInputElement>(null);
  const loadS19ButtonRef = useRef<HTMLButtonElement>(null);
  const loadListingButtonRef = useRef<HTMLButtonElement>(null);

  function windowStartFor(
    next: Pick<CpuSnapshot, "pc">,
    ranges = programSummary?.ranges,
  ): number | undefined {
    if (origin === "hex") {
      const parsed = parseHexWord(hexOrigin);
      return parsed === null ? undefined : alignedRowStart(parsed);
    }
    if (origin === "s19" && ranges?.[0]) {
      return alignedRowStart(ranges[0].start);
    }
    return alignedViewStart(next.pc);
  }

  function pinnedWindowStart(
    next: Pick<CpuSnapshot, "pc">,
    ranges = programSummary?.ranges,
  ): number | undefined {
    if (origin === "pc") {
      return undefined;
    }
    return windowStartFor(next, ranges);
  }

  async function applySnapshot(
    next: CpuSnapshot,
    view?: MemoryView,
    clearTrace = false,
  ) {
    setSnapshot(next);
    if (clearTrace) {
      setLastStep(null);
      setRunInfo(null);
    }
    if (view) {
      setMemoryView(view);
      return;
    }
    const start = windowStartFor(next) ?? alignedViewStart(next.pc);
    await showWindow(start);
  }

  async function showWindow(start: number) {
    const generation = inspectGeneration.current + 1;
    inspectGeneration.current = generation;
    const view = await inspectMemory(alignedRowStart(start), 256);
    if (generation === inspectGeneration.current) {
      setMemoryView(view);
    }
  }

  async function applyExecution(result: ExecutionResult) {
    setSnapshot(result.snapshot);
    setLastStep(result.lastStep);
    setRunInfo(result.run ?? null);
    if (origin === "pc") {
      setMemoryView(result.memoryView);
      return;
    }
    const start = windowStartFor(result.snapshot);
    if (start === undefined) {
      setMemoryView(result.memoryView);
      return;
    }
    await showWindow(start);
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
      setError(null);
    } catch (cause) {
      const parsed = parseIpcError(cause);
      setError(formatError(parsed));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    void reset()
      .then(async (next) => {
        if (cancelled) {
          return;
        }
        const view = await inspectMemory(alignedViewStart(next.pc), 256);
        if (!cancelled) {
          setSnapshot(next);
          setMemoryView(view);
          setLastStep(null);
          setRunInfo(null);
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

  function openS19Picker() {
    fileInputRef.current?.click();
  }

  function openListingPicker() {
    listingInputRef.current?.click();
  }

  async function onS19Selected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    if (!S19_NAME.test(file.name)) {
      setError(
        "invalid_s19: use un archivo Motorola S19 (.s19, .srec o .mot).",
      );
      return;
    }
    setBusy(true);
    try {
      const contents = await file.text();
      const result = await loadS19(contents);
      setProgramName(file.name);
      setProgramSummary(result.summary);
      const start =
        windowStartFor(result.snapshot, result.summary.ranges) ??
        alignedViewStart(result.snapshot.pc);
      await applySnapshot(
        result.snapshot,
        await inspectMemory(start, 256),
        true,
      );
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
      loadS19ButtonRef.current?.focus();
    }
  }

  async function onListingSelected(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) {
      return;
    }
    if (!LISTING_NAME.test(file.name)) {
      setError("invalid_listing: use un listado compilado (.lst o .txt).");
      return;
    }
    setBusy(true);
    try {
      const contents = await file.text();
      const result = await loadListing(contents);
      setProgramName(file.name);
      setProgramSummary(result.summary);
      const start =
        windowStartFor(result.snapshot, result.summary.ranges) ??
        alignedViewStart(result.snapshot.pc);
      await applySnapshot(
        result.snapshot,
        await inspectMemory(start, 256),
        true,
      );
      setError(null);
    } catch (cause) {
      setError(formatError(parseIpcError(cause)));
    } finally {
      setBusy(false);
      loadListingButtonRef.current?.focus();
    }
  }

  function onLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const start = parseHexWord(startInput);
    const data = parseHexBytes(dataInput);
    if (start === null || data === null) {
      setError("Use una dirección de 16 bits y bytes hexadecimales.");
      return;
    }
    void runAction(async () => {
      const next = await loadBytes(start, data);
      await applySnapshot(next);
    });
  }

  function onInspectOrigin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot) {
      return;
    }
    const start = windowStartFor(snapshot);
    if (start === undefined) {
      setError("Use una dirección de 16 bits para la ventana.");
      return;
    }
    void runAction(async () => {
      await showWindow(start);
    });
  }

  function pinHexWindow(start: number, nextCursor: number) {
    setOrigin("hex");
    setHexOrigin(hexWord(alignedRowStart(start)));
    setCursor(nextCursor);
    void showWindow(start).catch((cause: unknown) => {
      setError(formatError(parseIpcError(cause)));
    });
  }

  function onWriteByte(address: number, value: number) {
    void runAction(async () => {
      const result = await writeMemory(
        address,
        value,
        memoryView ? alignedRowStart(memoryView.start) : undefined,
      );
      setSnapshot(result.snapshot);
      setMemoryView(result.memoryView);
    });
  }

  function onRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const limit = Number.parseInt(maxSteps, 10);
    void runAction(async () => {
      const result = await run(
        limit,
        pinnedWindowStart({ pc: snapshot?.pc ?? 0 }),
      );
      await applyExecution(result);
    });
  }

  const flags = snapshot?.ccrFlags;

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-2">
          <p className="text-sm font-semibold tracking-[0.3em] text-amber-400">
            MC68HC11E9
          </p>
          <h1 className="text-3xl font-bold">Inspector del núcleo</h1>
          <p className="max-w-2xl text-slate-400">
            Reset, Step o Run. Cargue un S19 o un listado compilado (línea,
            dirección, bytes). El volcado y el último paso salen del núcleo.
          </p>
        </header>

        <div
          className="flex flex-wrap items-end gap-3"
          role="group"
          aria-label="Control de ejecución"
        >
          <button
            type="button"
            className="rounded bg-amber-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const next = await reset();
                await applySnapshot(next, undefined, true);
              })
            }
          >
            Reset
          </button>
          <button
            type="button"
            className="rounded border border-slate-500 px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={() =>
              void runAction(async () => {
                const result = await step(
                  pinnedWindowStart({ pc: snapshot?.pc ?? 0 }),
                );
                await applyExecution(result);
              })
            }
          >
            Step
          </button>
          <form
            onSubmit={onRun}
            className="flex flex-wrap items-end gap-2"
            aria-labelledby="run-heading"
          >
            <h2 id="run-heading" className="sr-only">
              Ejecutar
            </h2>
            <label className="grid gap-1 text-sm">
              <span>Máx. pasos</span>
              <input
                className="w-24 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
                value={maxSteps}
                onChange={(event) => setMaxSteps(event.target.value)}
                inputMode="numeric"
                aria-describedby="run-help"
              />
            </label>
            <button
              type="submit"
              className="rounded bg-slate-100 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
              disabled={busy}
            >
              Run
            </button>
          </form>
          <button
            ref={loadS19ButtonRef}
            type="button"
            className="rounded border border-amber-400/60 px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={openS19Picker}
          >
            Cargar S19
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".s19,.srec,.mot,text/plain"
            className="sr-only"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => void onS19Selected(event)}
            aria-hidden="true"
          />
          <button
            ref={loadListingButtonRef}
            type="button"
            className="rounded border border-amber-400/60 px-4 py-2 font-semibold disabled:opacity-50"
            disabled={busy}
            onClick={openListingPicker}
          >
            Cargar listado
          </button>
          <input
            ref={listingInputRef}
            type="file"
            accept=".lst,.txt,text/plain"
            className="sr-only"
            tabIndex={-1}
            disabled={busy}
            onChange={(event) => void onListingSelected(event)}
            aria-hidden="true"
          />
        </div>
        <p id="run-help" className="text-sm text-slate-500">
          Run se detiene al agotar el cupo o ante un opcode no implementado.
        </p>

        {error ? (
          <p
            role="alert"
            className="rounded border border-red-500/40 bg-red-950/40 px-4 py-3"
          >
            {error}
          </p>
        ) : null}

        {runInfo ? (
          <p className="text-sm text-slate-300">
            Run: {runInfo.stepsTaken} pasos ·{" "}
            {runInfo.stopReason === "limit"
              ? "límite alcanzado"
              : "opcode no implementado"}
          </p>
        ) : null}

        <section aria-labelledby="registers-heading" className="space-y-3">
          <h2 id="registers-heading" className="text-xl font-semibold">
            Registros
          </h2>
          <table className="w-full max-w-xl border-collapse text-left">
            <caption className="sr-only">Estado actual de la CPU</caption>
            <tbody>
              {registerRows(snapshot).map((row) => (
                <tr key={row.label} className="border-b border-slate-800">
                  <th
                    scope="row"
                    className="py-2 pr-4 font-medium text-slate-400"
                  >
                    {row.label}
                  </th>
                  <td className="py-2 font-mono">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-mono text-sm text-slate-400">
            CCR {flags ? flagLine(flags) : "—"} · INIT $
            {snapshot ? hexByte(snapshot.init) : "--"} · ciclos{" "}
            {snapshot?.cycles ?? "—"}
          </p>
        </section>

        <section aria-labelledby="last-step-heading" className="space-y-2">
          <h2 id="last-step-heading" className="text-xl font-semibold">
            Último paso
          </h2>
          <LastStepPanel lastStep={lastStep} />
        </section>

        <section aria-labelledby="program-heading" className="space-y-2">
          <h2 id="program-heading" className="text-xl font-semibold">
            Programa de sesión
          </h2>
          {programName && programSummary ? (
            <p className="font-mono text-sm text-slate-300">
              {programName} · {programSummary.bytesLoaded} bytes ·{" "}
              {programSummary.recordCount} registros ·{" "}
              {programSummary.ranges.length > 0
                ? programSummary.ranges
                    .map(
                      (range) =>
                        `$${hexWord(range.start)}-$${hexWord(range.end)}`,
                    )
                    .join(", ")
                : "sin rangos"}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Ningún S19 ni listado cargado. La imagen se pierde al cerrar la
              aplicación.
            </p>
          )}
        </section>

        <section aria-labelledby="memory-heading" className="space-y-3">
          <h2 id="memory-heading" className="text-xl font-semibold">
            Memoria
          </h2>
          <form
            onSubmit={onInspectOrigin}
            className="flex flex-wrap items-end gap-4"
            aria-label="Origen de la ventana"
          >
            <fieldset className="grid gap-2 text-sm">
              <legend className="text-slate-400">Origen</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="origin"
                  checked={origin === "pc"}
                  onChange={() => setOrigin("pc")}
                />
                Seguir PC
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="origin"
                  checked={origin === "s19"}
                  onChange={() => setOrigin("s19")}
                  disabled={!programSummary?.ranges.length}
                />
                Primer rango S19
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="origin"
                  checked={origin === "hex"}
                  onChange={() => setOrigin("hex")}
                />
                Dirección
              </label>
            </fieldset>
            <label className="grid gap-1 text-sm">
              <span>Dirección hex</span>
              <input
                className="w-28 rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
                value={hexOrigin}
                onChange={(event) => setHexOrigin(event.target.value)}
                spellCheck={false}
                disabled={origin !== "hex"}
              />
            </label>
            <fieldset className="grid gap-2 text-sm">
              <legend className="text-slate-400">Formato</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="byte-format"
                  checked={byteFormat === "hex"}
                  onChange={() => setByteFormat("hex")}
                />
                Hex
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="byte-format"
                  checked={byteFormat === "bin"}
                  onChange={() => setByteFormat("bin")}
                />
                Binario
              </label>
            </fieldset>
            <button
              type="submit"
              className="rounded border border-slate-500 px-4 py-2 font-semibold disabled:opacity-50"
              disabled={busy}
            >
              Inspeccionar
            </button>
          </form>
          <MemoryHex
            view={memoryView}
            pc={snapshot?.pc ?? null}
            lastStep={lastStep}
            cursor={cursor}
            format={byteFormat}
            busy={busy}
            onCursorChange={setCursor}
            onWindowChange={pinHexWindow}
            onWriteByte={onWriteByte}
          />
        </section>

        <form
          onSubmit={onLoad}
          className="grid max-w-xl gap-3"
          aria-labelledby="load-heading"
        >
          <h2 id="load-heading" className="text-xl font-semibold">
            Cargar bytes
          </h2>
          <label className="grid gap-1">
            <span>Dirección inicial</span>
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              value={startInput}
              onChange={(event) => setStartInput(event.target.value)}
              spellCheck={false}
              aria-describedby="load-help"
            />
          </label>
          <label className="grid gap-1">
            <span>Bytes hexadecimales</span>
            <input
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 font-mono"
              value={dataInput}
              onChange={(event) => setDataInput(event.target.value)}
              spellCheck={false}
            />
          </label>
          <p id="load-help" className="text-sm text-slate-500">
            Ejemplo: dirección 0000 y datos 86 55 4F para LDAA #$55 y CLRA.
          </p>
          <button
            type="submit"
            className="w-fit rounded bg-slate-100 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50"
            disabled={busy}
          >
            Cargar
          </button>
        </form>
      </div>
    </main>
  );
}

function formatError(error: IpcError) {
  return `${error.code}: ${error.message}`;
}

function flagLine(flags: NonNullable<CpuSnapshot["ccrFlags"]>) {
  return (["s", "x", "h", "i", "n", "z", "v", "c"] as const)
    .map((flag) => `${flag.toUpperCase()}${flags[flag] ? "1" : "0"}`)
    .join(" ");
}

function registerRows(snapshot: CpuSnapshot | null) {
  if (!snapshot) {
    return [
      { label: "A", value: "—" },
      { label: "B", value: "—" },
      { label: "D", value: "—" },
      { label: "IX", value: "—" },
      { label: "IY", value: "—" },
      { label: "SP", value: "—" },
      { label: "PC", value: "—" },
      { label: "CCR", value: "—" },
    ];
  }
  return [
    { label: "A", value: `$${hexByte(snapshot.a)}` },
    { label: "B", value: `$${hexByte(snapshot.b)}` },
    { label: "D", value: `$${hexWord(snapshot.d)}` },
    { label: "IX", value: `$${hexWord(snapshot.x)}` },
    { label: "IY", value: `$${hexWord(snapshot.y)}` },
    { label: "SP", value: `$${hexWord(snapshot.sp)}` },
    { label: "PC", value: `$${hexWord(snapshot.pc)}` },
    { label: "CCR", value: `$${hexByte(snapshot.ccr)}` },
  ];
}

export default App;
