import test from "node:test";
import assert from "node:assert/strict";
import {
  disassembleBytes,
  disassembleHexStrings,
  MAX_INSTRUCTION_PARAMS,
} from "../src/features/program/disassembler.ts";
import {
  addProgramLineParam,
  removeProgramLineParam,
  parseCodeLine,
} from "../src/features/program/programSync.ts";

test("Disassembles inherent instructions", () => {
  const nop = disassembleBytes([0x01]);
  assert.equal(nop.mnemonic, "NOP");
  assert.equal(nop.operands, "");
  assert.equal(nop.formatted, "NOP");
  assert.equal(nop.isComplete, true);
  assert.equal(nop.expectedParamBytes, 0);

  const clra = disassembleBytes([0x4f]);
  assert.equal(clra.formatted, "CLRA");
  assert.equal(clra.expectedParamBytes, 0);
});

test("Disassembles immediate 8-bit and 16-bit instructions", () => {
  const ldaa = disassembleBytes([0x86, 0x08]);
  assert.equal(ldaa.formatted, "LDAA #$08");
  assert.equal(ldaa.expectedParamBytes, 1);
  assert.equal(ldaa.isComplete, true);

  const ldx = disassembleBytes([0xce, 0x30, 0x00]);
  assert.equal(ldx.formatted, "LDX #$3000");
  assert.equal(ldx.expectedParamBytes, 2);
  assert.equal(ldx.isComplete, true);

  // Incomplete immediate 16-bit
  const ldxIncomplete = disassembleBytes([0xce, 0x30]);
  assert.equal(ldxIncomplete.isComplete, false);
  assert.equal(ldxIncomplete.actualParamBytes, 1);
  assert.equal(ldxIncomplete.expectedParamBytes, 2);
  assert.equal(ldxIncomplete.formatted, "LDX #$30??");
});

test("Disassembles direct and extended instructions", () => {
  const staaDir = disassembleBytes([0x97, 0x60]);
  assert.equal(staaDir.formatted, "STAA $60");

  const jmpExt = disassembleBytes([0x7e, 0x20, 0x1a]);
  assert.equal(jmpExt.formatted, "JMP $201A");
});

test("Disassembles indexed instructions for X and Y registers", () => {
  const staaIndX = disassembleBytes([0xa7, 0x00]);
  assert.equal(staaIndX.formatted, "STAA $00,X");

  const staaIndY = disassembleBytes([0x18, 0xa7, 0x00]);
  assert.equal(staaIndY.formatted, "STAA $00,Y");
  assert.equal(staaIndY.opcodeBytesCount, 2);
  assert.equal(staaIndY.expectedParamBytes, 1);
});

test("Disassembles relative branch with target calculation", () => {
  // Line 16: $2018 26 F3 -> $2018 + 2 - 13 = $200D
  const bne = disassembleBytes([0x26, 0xf3], 0x2018);
  assert.equal(bne.formatted, "BNE $200D");
  assert.equal(bne.isComplete, true);
});

test("Disassembles bit manipulation and branch bit instructions", () => {
  const bset = disassembleBytes([0x14, 0x40, 0x80]);
  assert.equal(bset.formatted, "BSET $40, $80");
  assert.equal(bset.expectedParamBytes, 2);

  // $2014 13 40 01 03 -> $2014 + 4 + 3 = $201B
  const brclr = disassembleBytes([0x13, 0x40, 0x01, 0x03], 0x2014);
  assert.equal(brclr.formatted, "BRCLR $40, $01, $201B");
  assert.equal(brclr.expectedParamBytes, 3);
  assert.equal(brclr.isComplete, true);
});

test("Disassembles all SAMPLE_PROGRAM_2000 instructions accurately", () => {
  const sample = [
    { bytes: ["86", "08"], addr: 0x2000, expected: "LDAA #$08" },
    { bytes: ["97", "60"], addr: 0x2002, expected: "STAA $60" },
    { bytes: ["CE", "30", "00"], addr: 0x2004, expected: "LDX #$3000" },
    { bytes: ["4F"], addr: 0x2007, expected: "CLRA" },
    { bytes: ["4C"], addr: 0x2008, expected: "INCA" },
    { bytes: ["A7", "00"], addr: 0x2009, expected: "STAA $00,X" },
    { bytes: ["A7", "01"], addr: 0x200b, expected: "STAA $01,X" },
    { bytes: ["A6", "00"], addr: 0x200d, expected: "LDAA $00,X" },
    { bytes: ["E6", "01"], addr: 0x200f, expected: "LDAB $01,X" },
    { bytes: ["1B"], addr: 0x2011, expected: "ABA" },
    { bytes: ["A7", "02"], addr: 0x2012, expected: "STAA $02,X" },
    { bytes: ["08"], addr: 0x2014, expected: "INX" },
    { bytes: ["7A", "00", "60"], addr: 0x2015, expected: "DEC $0060" },
    { bytes: ["26", "F3"], addr: 0x2018, expected: "BNE $200D" },
    { bytes: ["7E", "20", "1A"], addr: 0x201a, expected: "JMP $201A" },
  ];

  for (const item of sample) {
    const res = disassembleHexStrings(item.bytes, item.addr);
    assert.equal(res.formatted, item.expected);
  }
});

test("Limits parameter additions to MAX_INSTRUCTION_PARAMS = 3", () => {
  const content = "1 2000 86 08";
  // Initially 1 parameter (08)
  const add1 = addProgramLineParam(content, 0, 0x55, MAX_INSTRUCTION_PARAMS);
  assert.ok(add1);
  assert.equal(add1.writes.length, 3);
  const parsed1 = parseCodeLine(add1.updatedContent, 0);
  assert.deepEqual(parsed1.bytes, ["86", "08", "55"]);

  // Add 3rd parameter
  const add2 = addProgramLineParam(
    add1.updatedContent,
    0,
    0xaa,
    MAX_INSTRUCTION_PARAMS,
  );
  assert.ok(add2);
  const parsed2 = parseCodeLine(add2.updatedContent, 0);
  assert.deepEqual(parsed2.bytes, ["86", "08", "55", "AA"]);

  // Attempt to add 4th parameter -> must fail (limit is 3)
  const add3 = addProgramLineParam(
    add2.updatedContent,
    0,
    0xbb,
    MAX_INSTRUCTION_PARAMS,
  );
  assert.equal(add3, null);
});

test("Allows removing parameters but protects opcode", () => {
  const content = "1 2000 86 08 55";
  // Remove byte at index 2 (param 2)
  const rem1 = removeProgramLineParam(content, 0, 2);
  assert.ok(rem1);
  const parsed1 = parseCodeLine(rem1.updatedContent, 0);
  assert.deepEqual(parsed1.bytes, ["86", "08"]);

  // Cannot remove byte at index 0 (opcode)
  const remOpcode = removeProgramLineParam(rem1.updatedContent, 0, 0);
  assert.equal(remOpcode, null);
});
