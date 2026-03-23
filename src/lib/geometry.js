export const ROWS_96 = ["A","B","C","D","E","F","G","H"];
export const COLS_96 = [1,2,3,4,5,6,7,8,9,10,11,12];
export const ROWS_48 = ["A","B","C","D","E","F","G","H"];
export const COLS_48 = [1,2,3,4,5,6];
export const CLONES_PER_48 = 15;

export const WELL_STATUS = {
  empty: { color: "#27272a", border: "#3f3f46", label: "Пусто" },
  picked: { color: "#059669", border: "#10b981", label: "Клон" },
  "control-wt": { color: "#d97706", border: "#f59e0b", label: "WT" },
  "control-blank": { color: "#52525b", border: "#71717a", label: "Blank" },
  dead: { color: "#7f1d1d", border: "#991b1b", label: "Нет роста" },
};

export const PLATE_TYPES = {
  source: { label: "Source 96", icon: "\u{1F9EB}" },
  passage: { label: "Passage 96", icon: "\u{1F504}" },
  culture: { label: "Culture 48-DWP", icon: "\u{1F9EA}" },
  flask: { label: "Колбы", icon: "\u{1F3FA}" },
};

export const EXP_TYPES = ["NTG","UV","CRISPR","EMS","ARTP","Other"];

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function posToWell(r, c) {
  return String.fromCharCode(65 + r) + (c + 1);
}

export function clonesPerPlate(replicates = 3) {
  const groupsPerRow = Math.floor(6 / replicates);
  return groupsPerRow * ROWS_48.length - 1;
}
