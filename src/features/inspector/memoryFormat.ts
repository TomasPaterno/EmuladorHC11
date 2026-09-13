export type ByteFormat = "hex" | "bin" | "dec";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function formatByte(value: number, format: ByteFormat) {
  if (format === "bin") {
    return value.toString(2).padStart(8, "0");
  }
  if (format === "dec") {
    return value.toString(10).padStart(3, " ");
  }
  return hexByte(value);
}

export function parseByteInput(
  input: string,
  format: ByteFormat,
): number | null {
  const trimmed = input.trim().replace(/^\$/, "").replace(/^0x/i, "");
  if (format === "bin") {
    if (!/^[01]{1,8}$/.test(trimmed)) {
      return null;
    }
    return Number.parseInt(trimmed, 2);
  }
  if (format === "dec") {
    if (!/^\d{1,3}$/.test(trimmed)) {
      return null;
    }
    const val = Number.parseInt(trimmed, 10);
    return val >= 0 && val <= 255 ? val : null;
  }
  if (!/^[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 16);
}
