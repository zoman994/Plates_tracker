import * as XLSX from "xlsx";

function download(wb, filename) {
  const data = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadAssayTemplate() {
  const wb = XLSX.utils.book_new();
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const data = [
    ["", 1, 2, 3, 4, 5, 6],
    ...rows.map((r) => [r, null, null, null, null, null, null]),
    [],
    ["Вставь OD значения в B2:G9"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 4 }, ...Array(6).fill({ wch: 10 })];
  XLSX.utils.book_append_sheet(wb, ws, "OD Data");
  download(wb, "template-assay-48dwp.xlsx");
}

export function downloadPickingTemplate() {
  const wb = XLSX.utils.book_new();
  const rows = ["A", "B", "C", "D", "E", "F", "G", "H"];
  const cols = Array.from({ length: 12 }, (_, i) => i + 1);
  const data = [
    ["", ...cols],
    ...rows.map((r) => [r, ...cols.map(() => null)]),
    [],
    ["Обозначения:"],
    ["  1 или + = клон"],
    ["  WT = wildtype контроль"],
    ["  BL = blank"],
    ["  X или 0 = нет роста"],
    ["  пусто = пустая лунка"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = [{ wch: 4 }, ...cols.map(() => ({ wch: 5 }))];
  XLSX.utils.book_append_sheet(wb, ws, "Picking Map");
  download(wb, "template-picking-96well.xlsx");
}
