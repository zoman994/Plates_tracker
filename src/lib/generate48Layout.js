import { ROWS_48, COLS_48 } from "./geometry";

/**
 * Generate 48-DWP layout.
 * @param {Array} clones - [{cloneId, sourceWell}]
 * @param {number} replicates - 2 or 3
 * @param {string} layout - "rows" (replicates in columns, default) or "cols" (replicates in rows)
 *
 * "rows" layout (default): replicates go horizontally
 *   Col: 1    2    3    4    5    6
 *   A: K1.r1 K1.r2 K1.r3 K2.r1 K2.r2 K2.r3
 *
 * "cols" layout: replicates go vertically
 *   Col: 1    2    3    4    5    6
 *   A: K1.r1 K2.r1 K3.r1 K4.r1 K5.r1 K6.r1
 *   B: K1.r2 K2.r2 K3.r2 K4.r2 K5.r2 K6.r2
 *   C: K1.r3 K2.r3 K3.r3 K4.r3 K5.r3 K6.r3
 */
export function generate48Layout(clones, replicates = 3, layout = "rows") {
  const wells = {};
  for (const r of ROWS_48)
    for (const c of COLS_48)
      wells[`${r}${c}`] = { status: "empty", cloneId: null, sourceWell: null, replicateNum: null };

  if (layout === "cols") {
    // Replicates go vertically (down rows)
    // Groups of `replicates` consecutive rows, all 6 columns used
    const groupsPerCol = Math.floor(8 / replicates); // rows groups: 2 (for 3x) or 4 (for 2x)
    const clonesPerPlate = groupsPerCol * COLS_48.length - 1; // -1 for WT

    let pos = 0;
    for (let i = 0; i < clones.length && pos < clonesPerPlate; i++, pos++) {
      const col = pos % COLS_48.length;
      const rowGroup = Math.floor(pos / COLS_48.length);
      const baseRow = rowGroup * replicates;
      for (let rep = 0; rep < replicates; rep++) {
        if (baseRow + rep < ROWS_48.length) {
          const w = `${ROWS_48[baseRow + rep]}${col + 1}`;
          wells[w] = {
            status: "picked",
            cloneId: clones[i].cloneId,
            sourceWell: clones[i].sourceWell,
            replicateNum: rep + 1,
          };
        }
      }
    }

    // WT in last position
    const wtPos = clonesPerPlate;
    const wtCol = wtPos % COLS_48.length;
    const wtRowGroup = Math.floor(wtPos / COLS_48.length);
    const wtBaseRow = wtRowGroup * replicates;
    for (let rep = 0; rep < replicates; rep++) {
      if (wtBaseRow + rep < ROWS_48.length) {
        const w = `${ROWS_48[wtBaseRow + rep]}${wtCol + 1}`;
        wells[w] = { status: "control-wt", cloneId: "WT", sourceWell: null, replicateNum: rep + 1 };
      }
    }

    return wells;
  }

  // Default "rows" layout: replicates go horizontally
  const groupsPerRow = Math.floor(6 / replicates);
  const maxClones = groupsPerRow * ROWS_48.length - 1;

  let pos = 0;
  for (let i = 0; i < clones.length && pos < maxClones; i++, pos++) {
    const row = Math.floor(pos / groupsPerRow);
    const group = pos % groupsPerRow;
    const baseCol = group * replicates;
    for (let rep = 0; rep < replicates; rep++) {
      const w = `${ROWS_48[row]}${baseCol + rep + 1}`;
      wells[w] = {
        status: "picked",
        cloneId: clones[i].cloneId,
        sourceWell: clones[i].sourceWell,
        replicateNum: rep + 1,
      };
    }
  }

  const wtRow = Math.floor(maxClones / groupsPerRow);
  const wtGroup = maxClones % groupsPerRow;
  const wtBaseCol = wtGroup * replicates;
  for (let rep = 0; rep < replicates; rep++) {
    const w = `${ROWS_48[wtRow]}${wtBaseCol + rep + 1}`;
    wells[w] = { status: "control-wt", cloneId: "WT", sourceWell: null, replicateNum: rep + 1 };
  }

  return wells;
}

/**
 * Calculate clones per plate for "cols" layout
 */
export function clonesPerPlateCols(replicates = 3) {
  const groupsPerCol = Math.floor(8 / replicates);
  return groupsPerCol * 6 - 1;
}
