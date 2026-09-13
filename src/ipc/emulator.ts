import { invoke } from "@tauri-apps/api/core";

export const SCHEMA_VERSION = 1;
export const MAX_LOAD_BYTES = 4096;
export const MAX_S19_TEXT_BYTES = 256 * 1024;
export const MAX_LISTING_TEXT_BYTES = 256 * 1024;
export const MEMORY_VIEW_BYTES = 256;
export const MAX_RUN_STEPS = 10_000;

export type CcrFlags = {
  s: boolean;
  x: boolean;
  h: boolean;
  i: boolean;
  n: boolean;
  z: boolean;
  v: boolean;
  c: boolean;
};

export type MemoryWindow = {
  start: number;
  bytes: number[];
};

export type CpuSnapshot = {
  schemaVersion: number;
  variant: string;
  a: number;
  b: number;
  d: number;
  x: number;
  y: number;
  sp: number;
  pc: number;
  ccr: number;
  ccrFlags: CcrFlags;
  cycles: number;
  init: number;
  memoryWindow: MemoryWindow;
};

export type IpcError = {
  code: string;
  message: string;
};

export type AddressRange = {
  start: number;
  end: number;
};

export type LoadSummary = {
  recordCount: number;
  bytesLoaded: number;
  ranges: AddressRange[];
};

export type LoadS19Result = {
  snapshot: CpuSnapshot;
  summary: LoadSummary;
};

export type ListingSummary = LoadSummary & {
  entry: number;
};

export type LoadListingResult = {
  snapshot: CpuSnapshot;
  summary: ListingSummary;
};

export type FieldChange = {
  name: string;
  from: number;
  to: number;
};

export type MemoryWrite = {
  address: number;
  old: number;
  new: number;
};

export type LastStep = {
  mnemonic: string;
  opcode: number;
  bytes: number[];
  pcBefore: number;
  pcAfter: number;
  cyclesAdded: number;
  registers: FieldChange[];
  ccr: FieldChange[];
  writes: MemoryWrite[];
};

export type MemoryView = {
  start: number;
  bytes: number[];
};

export type RunInfo = {
  stepsTaken: number;
  stopReason: "limit" | "unimplemented";
};

export type ExecutionResult = {
  snapshot: CpuSnapshot;
  lastStep: LastStep | null;
  memoryView: MemoryView;
  run?: RunInfo;
};

export type WriteMemoryResult = {
  snapshot: CpuSnapshot;
  memoryView: MemoryView;
};

export function alignedViewStart(pc: number): number {
  return pc & 0xff00;
}

export function alignedRowStart(address: number): number {
  return address & 0xfff0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isByte(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  );
}

function isWord(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 0xffff
  );
}

function isCcrFlags(value: unknown): value is CcrFlags {
  if (!isRecord(value)) {
    return false;
  }
  return ["s", "x", "h", "i", "n", "z", "v", "c"].every(
    (flag) => typeof value[flag] === "boolean",
  );
}

export function isCpuSnapshot(value: unknown): value is CpuSnapshot {
  if (!isRecord(value) || value.schemaVersion !== SCHEMA_VERSION) {
    return false;
  }
  if (typeof value.variant !== "string" || typeof value.cycles !== "number") {
    return false;
  }
  if (
    !isByte(value.a) ||
    !isByte(value.b) ||
    !isByte(value.ccr) ||
    !isByte(value.init)
  ) {
    return false;
  }
  if (
    !isWord(value.d) ||
    !isWord(value.x) ||
    !isWord(value.y) ||
    !isWord(value.sp) ||
    !isWord(value.pc)
  ) {
    return false;
  }
  if (!isCcrFlags(value.ccrFlags) || !isRecord(value.memoryWindow)) {
    return false;
  }
  const window = value.memoryWindow;
  return (
    isWord(window.start) &&
    Array.isArray(window.bytes) &&
    window.bytes.every((byte) => isByte(byte))
  );
}

export function parseIpcError(error: unknown): IpcError {
  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return { code: error.code, message: error.message };
  }
  if (typeof error === "string") {
    return { code: "invoke_failed", message: error };
  }
  return { code: "invoke_failed", message: "la invocación IPC falló" };
}

async function invokeSnapshot(command: string, args?: Record<string, unknown>) {
  const payload = await invoke<unknown>(command, args);
  if (!isCpuSnapshot(payload)) {
    throw {
      code: "invalid_snapshot",
      message: "el snapshot IPC no es válido",
    } satisfies IpcError;
  }
  return payload;
}

export function reset() {
  return invokeSnapshot("reset");
}

function isFieldChange(value: unknown): value is FieldChange {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    isWord(value.from) &&
    isWord(value.to)
  );
}

function isMemoryWrite(value: unknown): value is MemoryWrite {
  return (
    isRecord(value) &&
    isWord(value.address) &&
    isByte(value.old) &&
    isByte(value.new)
  );
}

export function isLastStep(value: unknown): value is LastStep {
  if (!isRecord(value) || typeof value.mnemonic !== "string") {
    return false;
  }
  if (
    !isByte(value.opcode) ||
    !isWord(value.pcBefore) ||
    !isWord(value.pcAfter) ||
    typeof value.cyclesAdded !== "number"
  ) {
    return false;
  }
  return (
    Array.isArray(value.bytes) &&
    value.bytes.every((byte) => isByte(byte)) &&
    Array.isArray(value.registers) &&
    value.registers.every(isFieldChange) &&
    Array.isArray(value.ccr) &&
    value.ccr.every(isFieldChange) &&
    Array.isArray(value.writes) &&
    value.writes.every(isMemoryWrite)
  );
}

export function isMemoryView(value: unknown): value is MemoryView {
  return (
    isRecord(value) &&
    isWord(value.start) &&
    Array.isArray(value.bytes) &&
    value.bytes.length > 0 &&
    value.bytes.length <= MEMORY_VIEW_BYTES &&
    value.bytes.every((byte) => isByte(byte))
  );
}

function isRunInfo(value: unknown): value is RunInfo {
  return (
    isRecord(value) &&
    typeof value.stepsTaken === "number" &&
    Number.isInteger(value.stepsTaken) &&
    value.stepsTaken >= 0 &&
    (value.stopReason === "limit" || value.stopReason === "unimplemented")
  );
}

export function isExecutionResult(value: unknown): value is ExecutionResult {
  if (!isRecord(value) || !isCpuSnapshot(value.snapshot)) {
    return false;
  }
  if (value.lastStep !== null && !isLastStep(value.lastStep)) {
    return false;
  }
  if (!isMemoryView(value.memoryView)) {
    return false;
  }
  return value.run === undefined || isRunInfo(value.run);
}

async function invokeExecution(
  command: string,
  args?: Record<string, unknown>,
) {
  const payload = await invoke<unknown>(command, args);
  if (!isExecutionResult(payload)) {
    throw {
      code: "invalid_snapshot",
      message: "el resultado de ejecución IPC no es válido",
    } satisfies IpcError;
  }
  return payload;
}

export function step(windowStart?: number) {
  return invokeExecution(
    "step",
    windowStart === undefined ? undefined : { windowStart },
  );
}

export function run(maxSteps: number, windowStart?: number) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > MAX_RUN_STEPS) {
    return Promise.reject({
      code: "invalid_run_limit",
      message: "el máximo de pasos debe estar entre 1 y 10000",
    } satisfies IpcError);
  }
  return invokeExecution("run", {
    maxSteps,
    ...(windowStart === undefined ? {} : { windowStart }),
  });
}

export function isWriteMemoryResult(
  value: unknown,
): value is WriteMemoryResult {
  return (
    isRecord(value) &&
    isCpuSnapshot(value.snapshot) &&
    isMemoryView(value.memoryView)
  );
}

export function writeMemory(
  address: number,
  value: number,
  windowStart?: number,
) {
  if (!isWord(address) || !isByte(value)) {
    return Promise.reject({
      code: "invalid_load",
      message: "la escritura debe ser una dirección de 16 bits y un byte",
    } satisfies IpcError);
  }
  if (windowStart !== undefined && !isWord(windowStart)) {
    return Promise.reject({
      code: "inspect_too_large",
      message: "la ventana de inspección no es válida",
    } satisfies IpcError);
  }
  return invoke<unknown>("write_memory", {
    address,
    value,
    ...(windowStart === undefined ? {} : { windowStart }),
  }).then((payload) => {
    if (!isWriteMemoryResult(payload)) {
      throw {
        code: "invalid_snapshot",
        message: "el resultado de escritura IPC no es válido",
      } satisfies IpcError;
    }
    return payload;
  });
}

export function inspectMemory(start: number, length: number) {
  if (
    !isWord(start) ||
    !Number.isInteger(length) ||
    length < 1 ||
    length > MEMORY_VIEW_BYTES
  ) {
    return Promise.reject({
      code: "inspect_too_large",
      message: "la ventana de inspección debe tener entre 1 y 256 bytes",
    } satisfies IpcError);
  }
  return invoke<unknown>("inspect_memory", { start, length }).then(
    (payload) => {
      if (!isMemoryView(payload)) {
        throw {
          code: "invalid_snapshot",
          message: "la vista de memoria IPC no es válida",
        } satisfies IpcError;
      }
      return payload;
    },
  );
}

function isAddressRange(value: unknown): value is AddressRange {
  return isRecord(value) && isWord(value.start) && isWord(value.end);
}

function isLoadSummary(value: unknown): value is LoadSummary {
  if (!isRecord(value)) {
    return false;
  }
  if (
    typeof value.recordCount !== "number" ||
    !Number.isInteger(value.recordCount) ||
    value.recordCount < 0
  ) {
    return false;
  }
  if (
    typeof value.bytesLoaded !== "number" ||
    !Number.isInteger(value.bytesLoaded) ||
    value.bytesLoaded < 0
  ) {
    return false;
  }
  return Array.isArray(value.ranges) && value.ranges.every(isAddressRange);
}

export function isLoadS19Result(value: unknown): value is LoadS19Result {
  return (
    isRecord(value) &&
    isCpuSnapshot(value.snapshot) &&
    isLoadSummary(value.summary)
  );
}

export function isListingSummary(value: unknown): value is ListingSummary {
  return isLoadSummary(value) && isWord((value as { entry?: unknown }).entry);
}

export function isLoadListingResult(
  value: unknown,
): value is LoadListingResult {
  return (
    isRecord(value) &&
    isCpuSnapshot(value.snapshot) &&
    isListingSummary(value.summary)
  );
}

export function loadListing(contents: string) {
  if (contents.length > MAX_LISTING_TEXT_BYTES) {
    return Promise.reject({
      code: "load_too_large",
      message: "el listado excede el tamaño máximo permitido",
    } satisfies IpcError);
  }
  return invoke<unknown>("load_listing", { contents }).then((payload) => {
    if (!isLoadListingResult(payload)) {
      throw {
        code: "invalid_snapshot",
        message: "el resultado de carga del listado no es válido",
      } satisfies IpcError;
    }
    return payload;
  });
}

export function loadS19(contents: string) {
  if (contents.length > MAX_S19_TEXT_BYTES) {
    return Promise.reject({
      code: "load_too_large",
      message: "el archivo S19 excede el tamaño máximo permitido",
    } satisfies IpcError);
  }
  return invoke<unknown>("load_s19", { contents }).then((payload) => {
    if (!isLoadS19Result(payload)) {
      throw {
        code: "invalid_snapshot",
        message: "el resultado de carga S19 no es válido",
      } satisfies IpcError;
    }
    return payload;
  });
}

export function loadBytes(start: number, data: number[]) {
  if (
    !isWord(start) ||
    data.length > MAX_LOAD_BYTES ||
    !data.every((byte) => isByte(byte))
  ) {
    return Promise.reject({
      code: "invalid_load",
      message:
        "la carga debe ser una dirección de 16 bits y como máximo 4096 bytes",
    } satisfies IpcError);
  }
  return invokeSnapshot("load_bytes", { start, data });
}

export function parseHexWord(input: string): number | null {
  const normalized = input.trim().replace(/^\$/, "").replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{1,4}$/.test(normalized)) {
    return null;
  }
  return Number.parseInt(normalized, 16);
}

export function parseHexBytes(input: string): number[] | null {
  const tokens = input
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (tokens.length === 0) {
    return [];
  }
  const bytes: number[] = [];
  for (const token of tokens) {
    const value = token.replace(/^\$/, "").replace(/^0x/i, "");
    if (!/^[0-9a-fA-F]{1,2}$/.test(value)) {
      return null;
    }
    bytes.push(Number.parseInt(value, 16));
  }
  return bytes;
}
