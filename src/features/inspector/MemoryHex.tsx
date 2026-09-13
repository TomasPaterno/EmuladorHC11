import {
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  WheelEvent,
} from "react";
import { LastStep, MemoryView } from "../../ipc/emulator";
import { ByteFormat, formatByte, parseByteInput } from "./memoryFormat";

const COLUMNS = 16;
const VISIBLE_ROWS = 16;
const TOTAL_ROWS = 4096;
const ROW_HEIGHT_PX = 28;

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

function hexWord(value: number) {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

type MemoryHexProps = {
  view: MemoryView | null;
  pc: number | null;
  lastStep: LastStep | null;
  cursor: number;
  format: ByteFormat;
  busy?: boolean;
  onCursorChange: (index: number) => void;
  onWindowChange: (start: number, cursor: number) => void;
  onWriteByte: (address: number, value: number) => void;
};

export function MemoryHex({
  view,
  pc,
  lastStep,
  cursor,
  format,
  busy = false,
  onCursorChange,
  onWindowChange,
  onWriteByte,
}: MemoryHexProps) {
  const writeSet = useMemo(() => {
    const addresses = new Set<number>();
    for (const write of lastStep?.writes ?? []) {
      addresses.add(write.address);
    }
    return addresses;
  }, [lastStep]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const suppressScroll = useRef(false);
  const [edit, setEdit] = useState<{
    start: number;
    format: ByteFormat;
    index: number;
    draft: string;
  } | null>(null);
  const viewStart = view?.start;
  const editingIndex =
    edit &&
    viewStart !== undefined &&
    edit.start === viewStart &&
    edit.format === format
      ? edit.index
      : null;
  const draft = edit?.draft ?? "";

  useEffect(() => {
    const node = scrollRef.current;
    if (!node || viewStart === undefined) {
      return;
    }
    const row = (viewStart & 0xffff) / 16;
    if (Math.abs(node.scrollTop - row) > 0.5) {
      suppressScroll.current = true;
      node.scrollTop = row;
    }
  }, [viewStart]);

  if (!view) {
    return (
      <p className="text-sm text-slate-500">
        Sin ventana de memoria. Pulse Reset o cargue un programa.
      </p>
    );
  }

  const dump = view;
  const columns = Array.from({ length: COLUMNS }, (_, index) => index);
  const rows = Math.ceil(dump.bytes.length / COLUMNS);
  const safeCursor = Math.min(cursor, dump.bytes.length - 1);
  const cursorAddress = (dump.start + safeCursor) & 0xffff;
  const cursorValue = dump.bytes[safeCursor];
  const viewportPx = VISIBLE_ROWS * ROW_HEIGHT_PX;

  function commitEdit(index: number) {
    const parsed = parseByteInput(draft, format);
    setEdit(null);
    if (parsed === null) {
      return;
    }
    const address = (dump.start + index) & 0xffff;
    if (parsed !== dump.bytes[index]) {
      onWriteByte(address, parsed);
    }
  }

  function beginEdit(index: number) {
    if (busy) {
      return;
    }
    onCursorChange(index);
    setEdit({
      start: dump.start,
      format,
      index,
      draft: formatByte(dump.bytes[index], format),
    });
  }

  function moveWindow(start: number, nextCursor: number) {
    setEdit(null);
    onWindowChange(start & 0xffff, nextCursor);
  }

  function moveCursor(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "Enter") {
      event.preventDefault();
      beginEdit(index);
      return;
    }
    if (event.key === "PageDown") {
      event.preventDefault();
      moveWindow(dump.start + 256, index);
      return;
    }
    if (event.key === "PageUp") {
      event.preventDefault();
      moveWindow(dump.start - 256, index);
      return;
    }
    if (event.key === "ArrowDown" && index + COLUMNS > dump.bytes.length - 1) {
      event.preventDefault();
      moveWindow(dump.start + COLUMNS, index);
      return;
    }
    if (event.key === "ArrowUp" && index < COLUMNS) {
      event.preventDefault();
      moveWindow(dump.start - COLUMNS, index);
      return;
    }
    const next =
      event.key === "ArrowRight"
        ? Math.min(index + 1, dump.bytes.length - 1)
        : event.key === "ArrowLeft"
          ? Math.max(index - 1, 0)
          : event.key === "ArrowDown"
            ? index + COLUMNS
            : event.key === "ArrowUp"
              ? index - COLUMNS
              : event.key === "Home"
                ? index - (index % COLUMNS)
                : event.key === "End"
                  ? Math.min(
                      index - (index % COLUMNS) + 15,
                      dump.bytes.length - 1,
                    )
                  : null;
    if (next === null) {
      return;
    }
    event.preventDefault();
    onCursorChange(next);
    const sibling = event.currentTarget
      .closest("table")
      ?.querySelector<HTMLButtonElement>(`button[data-offset="${next}"]`);
    sibling?.focus();
  }

  function onTableWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    node.scrollTop += event.deltaY > 0 ? 1 : -1;
  }

  function onScrollBar() {
    const node = scrollRef.current;
    if (!node) {
      return;
    }
    if (suppressScroll.current) {
      suppressScroll.current = false;
      return;
    }
    const row = Math.min(
      TOTAL_ROWS - 1,
      Math.max(0, Math.round(node.scrollTop)),
    );
    const start = (row * COLUMNS) & 0xffff;
    if (start !== dump.start) {
      moveWindow(start, safeCursor);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <div className="overflow-x-auto" onWheel={onTableWheel}>
          <table className="border-collapse font-mono text-sm">
            <caption className="sr-only">
              Volcado de 256 bytes desde ${hexWord(view.start)}, formato{" "}
              {format === "bin" ? "binario" : "hexadecimal"}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-2 py-1 text-left text-slate-500">
                  Addr
                </th>
                {columns.map((column) => (
                  <th
                    key={column}
                    scope="col"
                    className="px-1 py-1 text-slate-500"
                  >
                    {hexByte(column)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: rows }, (_, row) => {
                const rowAddress = (view.start + row * COLUMNS) & 0xffff;
                return (
                  <tr
                    key={`${rowAddress}-${row}`}
                    style={{ height: ROW_HEIGHT_PX }}
                  >
                    <th
                      scope="row"
                      className="px-2 py-0.5 text-left text-slate-500"
                    >
                      {hexWord(rowAddress)}
                    </th>
                    {columns.map((column) => {
                      const index = row * COLUMNS + column;
                      if (index >= view.bytes.length) {
                        return <td key={column} />;
                      }
                      const address = (view.start + index) & 0xffff;
                      const isPc = pc === address;
                      const isWrite = writeSet.has(address);
                      const isCursor = index === safeCursor;
                      const classes = [
                        format === "bin" ? "min-w-20" : "min-w-8",
                        "rounded px-1 py-0.5",
                        isPc
                          ? "bg-amber-400 text-slate-950"
                          : isWrite
                            ? "bg-cyan-700 text-slate-50"
                            : "hover:bg-slate-800",
                        isCursor ? "ring-2 ring-slate-100" : "",
                      ].join(" ");
                      return (
                        <td key={column} className="px-0.5 py-0.5 text-center">
                          {editingIndex === index ? (
                            <input
                              className={`${classes} w-full bg-slate-900 text-center text-slate-100 outline-none`}
                              value={draft}
                              autoFocus
                              spellCheck={false}
                              aria-label={`Editar $${hexWord(address)}`}
                              onChange={(event) =>
                                setEdit((current) =>
                                  current
                                    ? { ...current, draft: event.target.value }
                                    : current,
                                )
                              }
                              onBlur={() => commitEdit(index)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  commitEdit(index);
                                } else if (event.key === "Escape") {
                                  event.preventDefault();
                                  setEdit(null);
                                }
                              }}
                            />
                          ) : (
                            <button
                              type="button"
                              data-offset={index}
                              className={classes}
                              aria-label={`$${hexWord(address)} vale ${formatByte(view.bytes[index], format)}${isPc ? ", PC" : ""}${isWrite ? ", escrito" : ""}`}
                              aria-current={isCursor ? "true" : undefined}
                              disabled={busy}
                              onClick={() => onCursorChange(index)}
                              onDoubleClick={() => beginEdit(index)}
                              onKeyDown={(event) => moveCursor(event, index)}
                            >
                              {formatByte(view.bytes[index], format)}
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
        <div
          ref={scrollRef}
          className="shrink-0 overflow-y-auto"
          style={{ height: viewportPx, width: "0.85rem" }}
          onScroll={onScrollBar}
          aria-label="Desplazar direcciones de memoria"
        >
          <div style={{ height: viewportPx + TOTAL_ROWS - 1 }} />
        </div>
      </div>
      <p className="font-mono text-sm text-slate-400">
        Cursor ${hexWord(cursorAddress)} = {formatByte(cursorValue, format)} ·
        PC en ámbar · escrituras en cian · doble clic o Enter para editar
      </p>
    </div>
  );
}

type LastStepPanelProps = {
  lastStep: LastStep | null;
};

export function LastStepPanel({ lastStep }: LastStepPanelProps) {
  if (!lastStep) {
    return (
      <p className="text-sm text-slate-500">
        Vacío tras Reset. Ejecute Step o Run para ver el último cambio.
      </p>
    );
  }

  const bytes = lastStep.bytes.map((byte) => hexByte(byte)).join(" ");
  return (
    <div className="space-y-2 font-mono text-sm">
      <p>
        {lastStep.mnemonic} · ${hexByte(lastStep.opcode)} · {bytes} · $
        {hexWord(lastStep.pcBefore)} → ${hexWord(lastStep.pcAfter)} ·{" "}
        {lastStep.cyclesAdded} ciclos
      </p>
      {lastStep.registers.length > 0 ? (
        <p>
          {lastStep.registers
            .map(
              (change) =>
                `${change.name} $${hexWord(change.from)} → $${hexWord(change.to)}`,
            )
            .join(" · ")}
        </p>
      ) : null}
      {lastStep.ccr.length > 0 ? (
        <p>
          {lastStep.ccr
            .map((change) => `${change.name} ${change.from}→${change.to}`)
            .join(" · ")}
        </p>
      ) : null}
      {lastStep.writes.length > 0 ? (
        <p>
          {lastStep.writes
            .map(
              (write) =>
                `[$${hexWord(write.address)}]=$${hexByte(write.old)}→$${hexByte(write.new)}`,
            )
            .join(" · ")}
        </p>
      ) : (
        <p className="text-slate-500">Sin escrituras de memoria</p>
      )}
    </div>
  );
}
