export type ByteFormat = "hex" | "bin";

function hexByte(value: number) {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function formatByte(value: number, format: ByteFormat) {
  if (format === "bin") {
    return value.toString(2).padStart(8, "0");
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
  if (!/^[0-9a-fA-F]{1,2}$/.test(trimmed)) {
    return null;
  }
  return Number.parseInt(trimmed, 16);
}
