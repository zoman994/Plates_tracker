import { ROWS_48, COLS_48 } from "./geometry";

export function generate48Layout(clones, replicates = 3) {
  const wells = {};
  for (const r of ROWS_48)
    for (const c of COLS_48)
      wells[`${r}${c}`] = { status: "empty", cloneId: null, sourceWell: null, replicateNum: null };

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

  // WT control in last position
  const wtRow = Math.floor(maxClones / groupsPerRow);
  const wtGroup = maxClones % groupsPerRow;
  const wtBaseCol = wtGroup * replicates;
  for (let rep = 0; rep < replicates; rep++) {
    const w = `${ROWS_48[wtRow]}${wtBaseCol + rep + 1}`;
    wells[w] = { status: "control-wt", cloneId: "WT", sourceWell: null, replicateNum: rep + 1 };
  }

  return wells;
}
