/**
 * Generate Tecan EVO150 .gwl (Gemini Worklist) files.
 *
 * GWL format: semicolon-delimited, commands:
 *   A;rack;pos;vol   — Aspirate
 *   D;rack;pos;vol   — Dispense
 *   W;                — Wash
 *   C;comment         — Comment
 *   B;                — Break (pause)
 *
 * Well positions: 1-96 sequential (A1=1, B1=2, ..., H1=8, A2=9, ..., H12=96)
 * For 48-well: A1=1, B1=2, ..., H1=8, A2=9, ..., H6=48
 */

import { ROWS_96, ROWS_48 } from "./geometry";

function wellToPos96(well) {
  const row = well.charCodeAt(0) - 65; // A=0, B=1, ...
  const col = parseInt(well.slice(1)) - 1; // 1→0, 2→1, ...
  return col * 8 + row + 1;
}

function wellToPos48(well) {
  const row = well.charCodeAt(0) - 65;
  const col = parseInt(well.slice(1)) - 1;
  return col * 8 + row + 1;
}

/**
 * Generate GWL for 96→96 passage (stamp/replicate)
 */
export function generatePassageGwl(sourcePlate, destPlateName, volume = 5) {
  const lines = [];
  lines.push(`C;Passage: ${sourcePlate.name} -> ${destPlateName}`);
  lines.push(`C;Volume: ${volume} uL`);
  lines.push(`C;Date: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  for (const [well, data] of Object.entries(sourcePlate.wells)) {
    if (data.status === "picked" || data.status === "control-wt") {
      const pos = wellToPos96(well);
      lines.push(`A;Source;${pos};${volume};;`);
      lines.push(`D;Dest;${pos};${volume};;`);
      lines.push(`W;`);
    }
  }

  return lines.join("\r\n");
}

/**
 * Generate GWL for 96→48-DWP transfer with triplicates
 * cloneMapping: array of { sourceWell, destPlate, destWells: [w1, w2, w3] }
 */
export function generateTransfer96to48Gwl(sourcePlateName, transfers, volume = 10) {
  const lines = [];
  lines.push(`C;Transfer: ${sourcePlateName} -> 48-DWP`);
  lines.push(`C;Volume: ${volume} uL per replicate`);
  lines.push(`C;Date: ${new Date().toISOString().split("T")[0]}`);
  lines.push("");

  for (const t of transfers) {
    const srcPos = wellToPos96(t.sourceWell);
    lines.push(`C;Clone: ${t.cloneId} from ${t.sourceWell}`);
    for (const dw of t.destWells) {
      const destPos = wellToPos48(dw);
      lines.push(`A;Source96;${srcPos};${volume};;`);
      lines.push(`D;${t.destPlate};${destPos};${volume};;`);
    }
    lines.push(`W;`);
  }

  return lines.join("\r\n");
}

/**
 * Build transfer mapping from source plate and culture plates
 */
export function buildTransferMapping(sourcePlate, culturePlates) {
  const mapping = [];

  for (const cp of culturePlates) {
    const seen = new Set();
    for (const [well, data] of Object.entries(cp.wells)) {
      if (data.status === "picked" && data.cloneId && !seen.has(data.cloneId)) {
        seen.add(data.cloneId);
        // Find all replicate wells for this clone
        const destWells = Object.entries(cp.wells)
          .filter(([, w]) => w.cloneId === data.cloneId)
          .map(([w]) => w);
        mapping.push({
          cloneId: data.cloneId,
          sourceWell: data.sourceWell || "",
          destPlate: cp.name,
          destWells,
        });
      }
    }
  }

  return mapping;
}

/**
 * Download GWL file
 */
export function downloadGwl(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
