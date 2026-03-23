import * as XLSX from "xlsx";

/**
 * Parse an .xlsx file into a 2D array of values.
 * Returns rows × cols of raw cell values.
 */
export function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        resolve(raw);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse assay OD data from xlsx.
 * Expects row 0 = header (ignored), rows 1-8 = data.
 * Column 0 = row label (ignored), columns 1-6 = OD values.
 * Returns 8×6 matrix of numbers.
 */
export async function parseAssayXlsx(file) {
  const raw = await parseXlsx(file);
  const matrix = [];
  for (let ri = 1; ri <= 8 && ri < raw.length; ri++) {
    const row = [];
    for (let ci = 1; ci <= 6 && ci < (raw[ri]?.length || 0); ci++) {
      const val = parseFloat(raw[ri][ci]);
      row.push(isNaN(val) ? null : val);
    }
    matrix.push(row);
  }
  return matrix;
}

/**
 * Parse picking map from xlsx.
 * Expects row 0 = header, rows 1-8 = data.
 * Column 0 = row label, columns 1-12 = well status.
 * Values: 1/+ = picked, WT = control-wt, BL = blank, X/0 = dead, empty = empty
 * Returns { well: status } map.
 */
export async function parsePickingXlsx(file) {
  const raw = await parseXlsx(file);
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const result = {};

  for (let ri = 1; ri <= 8 && ri < raw.length; ri++) {
    for (let ci = 1; ci <= 12 && ci < (raw[ri]?.length || 0); ci++) {
      const well = `${rows[ri - 1]}${ci}`;
      const val = String(raw[ri][ci] ?? "").trim().toUpperCase();

      if (val === "1" || val === "+") {
        result[well] = "pick";
      } else if (val === "WT") {
        result[well] = "wt";
      } else if (val === "BL" || val === "BLANK") {
        result[well] = "blank";
      } else if (val === "X" || val === "0") {
        result[well] = "dead";
      }
      // empty string = skip (leave as empty)
    }
  }
  return result;
}
