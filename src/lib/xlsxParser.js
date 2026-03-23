import * as XLSX from "xlsx";

/**
 * Parse an .xlsx file into a 2D array of values with validation.
 */
export function parseXlsx(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error("Файл не выбран")); return; }
    const maxSize = 10 * 1024 * 1024; // 10 MB limit
    if (file.size > maxSize) { reject(new Error("Файл слишком большой (макс. 10 МБ)")); return; }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        if (!wb.SheetNames || wb.SheetNames.length === 0) {
          reject(new Error("Файл не содержит листов"));
          return;
        }
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null });
        if (!raw || raw.length === 0) {
          reject(new Error("Лист пустой"));
          return;
        }
        resolve(raw);
      } catch (err) {
        reject(new Error("Ошибка парсинга Excel: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Parse assay OD data from xlsx with validation.
 * Expects row 0 = header, rows 1-8 = data, columns 1-6 = OD values.
 * Returns 8×6 matrix of numbers (null for empty/invalid cells).
 */
export async function parseAssayXlsx(file) {
  const raw = await parseXlsx(file);

  if (raw.length < 2) throw new Error("Недостаточно строк. Нужно минимум 2 (заголовок + 1 строка данных)");

  const matrix = [];
  let validCount = 0;
  for (let ri = 1; ri <= 8 && ri < raw.length; ri++) {
    const row = [];
    for (let ci = 1; ci <= 6 && ci < (raw[ri]?.length || 0); ci++) {
      const val = parseFloat(raw[ri][ci]);
      if (!isNaN(val)) {
        if (val < -10 || val > 100) {
          throw new Error(`Подозрительное значение ${val} в строке ${ri + 1}, столбце ${ci + 1}. OD обычно 0-5.`);
        }
        row.push(val);
        validCount++;
      } else {
        row.push(null);
      }
    }
    matrix.push(row);
  }

  if (validCount === 0) throw new Error("Не найдено числовых значений. Проверьте формат файла.");

  return matrix;
}

/**
 * Parse picking map from xlsx with validation.
 * Values: 1/+ = picked, WT = control-wt, BL = blank, X/0 = dead
 */
export async function parsePickingXlsx(file) {
  const raw = await parseXlsx(file);
  const validRows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const result = {};

  if (raw.length < 2) throw new Error("Недостаточно строк. Нужно минимум 2.");

  let totalMarked = 0;
  for (let ri = 1; ri <= 8 && ri < raw.length; ri++) {
    for (let ci = 1; ci <= 12 && ci < (raw[ri]?.length || 0); ci++) {
      const well = `${validRows[ri - 1]}${ci}`;
      const val = String(raw[ri][ci] ?? "").trim().toUpperCase();

      if (val === "" || val === "NULL" || val === "UNDEFINED") continue;

      if (val === "1" || val === "+") {
        result[well] = "pick";
        totalMarked++;
      } else if (val === "WT" || val === "WILDTYPE") {
        result[well] = "wt";
        totalMarked++;
      } else if (val === "BL" || val === "BLANK") {
        result[well] = "blank";
        totalMarked++;
      } else if (val === "X" || val === "0" || val === "DEAD") {
        result[well] = "dead";
        totalMarked++;
      }
      // Unknown values are silently ignored
    }
  }

  if (totalMarked === 0) throw new Error("Не найдено отмеченных лунок. Используйте: 1/+ (клон), WT, BL, X/0 (dead).");

  return result;
}
