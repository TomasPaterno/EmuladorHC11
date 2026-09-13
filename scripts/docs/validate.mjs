import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import process from "node:process";
import YAML from "yaml";

const root = resolve(import.meta.dirname, "../..");
const hardware = join(root, "docs", "hardware");
const manifestPath = join(hardware, "manifest.yaml");
const specDirectory = join(hardware, "spec");
const errors = [];

function loadYaml(path) {
  try {
    return YAML.parse(readFileSync(path, "utf8"));
  } catch (error) {
    errors.push(`${path}: YAML inválido (${error.message})`);
    return {};
  }
}

function sha256(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function visit(value, callback) {
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, callback));
  } else if (value && typeof value === "object") {
    callback(value);
    Object.values(value).forEach((entry) => visit(entry, callback));
  }
}

const manifest = loadYaml(manifestPath);
if (manifest.schema_version !== 1 || !Array.isArray(manifest.documents)) {
  errors.push("manifest.yaml debe declarar schema_version: 1 y documents.");
}

const sourceIds = new Set();
for (const document of manifest.documents ?? []) {
  if (!document.source_id || sourceIds.has(document.source_id)) {
    errors.push(`source_id inválido o duplicado: ${document.source_id}`);
  }
  sourceIds.add(document.source_id);

  const path = join(hardware, document.source_path ?? "");
  if (!existsSync(path)) {
    errors.push(`${document.source_id}: no existe ${document.source_path}`);
    continue;
  }
  if (sha256(path) !== document.sha256) {
    errors.push(`${document.source_id}: SHA-256 no coincide`);
  }
  if (statSync(path).size !== document.bytes) {
    errors.push(`${document.source_id}: tamaño no coincide`);
  }
  if (!Number.isInteger(document.page_count) || document.page_count < 1) {
    errors.push(`${document.source_id}: page_count inválido`);
  }
}

const vectorRanges = [];
for (const file of readdirSync(specDirectory).filter((name) =>
  name.endsWith(".yaml"),
)) {
  const path = join(specDirectory, file);
  const data = loadYaml(path);
  if (data.schema_version !== 1) {
    errors.push(`${file}: schema_version debe ser 1`);
  }

  visit(data, (entry) => {
    if (entry.source_id && !sourceIds.has(entry.source_id)) {
      errors.push(`${file}: source_id desconocido ${entry.source_id}`);
    }
    if (
      entry.review_status &&
      ![
        "human_verified",
        "transcribed_needs_visual_check",
        "pending_pdf_page",
        "pending_pdf_page_and_addresses",
        "pending_pdf_page_and_table_transcription",
      ].includes(entry.review_status)
    ) {
      errors.push(`${file}: review_status desconocido ${entry.review_status}`);
    }
  });

  if (file === "interrupt-vectors.yaml") {
    for (const entry of data.e_series?.entries ?? []) {
      if (
        !Number.isInteger(entry.start) ||
        !Number.isInteger(entry.end) ||
        entry.end !== entry.start + 1
      ) {
        errors.push(`vector ${entry.id}: rango inválido`);
      }
      vectorRanges.push([entry.start, entry.end, entry.id]);
    }
  }
}

vectorRanges.sort((left, right) => left[0] - right[0]);
for (let index = 1; index < vectorRanges.length; index += 1) {
  if (vectorRanges[index][0] <= vectorRanges[index - 1][1]) {
    errors.push(
      `vectores solapados: ${vectorRanges[index - 1][2]} y ${vectorRanges[index][2]}`,
    );
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(
  `Corpus válido: ${sourceIds.size} documentos y ${vectorRanges.length} vectores E-series.`,
);
