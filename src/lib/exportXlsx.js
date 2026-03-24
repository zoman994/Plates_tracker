import * as XLSX from "xlsx";
import { ROWS_96, COLS_96, ROWS_48, COLS_48 } from "./geometry";

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

/**
 * Export a single plate to xlsx (plate map with clone IDs / status / OD values)
 */
export function exportPlate(plate, expId) {
  const wb = XLSX.utils.book_new();
  const rows = plate.format === 96 ? ROWS_96 : ROWS_48;
  const cols = plate.format === 96 ? COLS_96 : COLS_48;

  // Sheet 1: Clone Map
  const mapData = [["", ...cols]];
  for (const r of rows) {
    const row = [r];
    for (const c of cols) {
      const w = plate.wells[`${r}${c}`] || {};
      if (w.status === "picked") row.push(w.cloneId || "+");
      else if (w.status === "control-wt") row.push("WT");
      else if (w.status === "control-blank") row.push("BL");
      else if (w.status === "dead") row.push("X");
      else row.push("");
    }
    mapData.push(row);
  }
  const wsMap = XLSX.utils.aoa_to_sheet(mapData);
  wsMap["!cols"] = [{ wch: 4 }, ...cols.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, wsMap, "Clone Map");

  // Sheet 2: Status Map
  const statusData = [["", ...cols]];
  for (const r of rows) {
    const row = [r];
    for (const c of cols) {
      const w = plate.wells[`${r}${c}`] || {};
      row.push(w.status || "empty");
    }
    statusData.push(row);
  }
  const wsStatus = XLSX.utils.aoa_to_sheet(statusData);
  wsStatus["!cols"] = [{ wch: 4 }, ...cols.map(() => ({ wch: 12 }))];
  XLSX.utils.book_append_sheet(wb, wsStatus, "Status");

  // Sheet 3: OD Values (if any)
  const hasOD = Object.values(plate.wells).some((w) => w.value !== undefined);
  if (hasOD) {
    const odData = [["", ...cols]];
    for (const r of rows) {
      const row = [r];
      for (const c of cols) {
        const w = plate.wells[`${r}${c}`] || {};
        row.push(w.value !== undefined ? w.value : null);
      }
      odData.push(row);
    }
    const wsOD = XLSX.utils.aoa_to_sheet(odData);
    wsOD["!cols"] = [{ wch: 4 }, ...cols.map(() => ({ wch: 10 }))];
    XLSX.utils.book_append_sheet(wb, wsOD, "OD Values");
  }

  // Sheet 4: Details (flat list of non-empty wells)
  const detailData = [["Well", "Status", "Clone ID", "Source Well", "Replicate", "OD"]];
  for (const r of rows) {
    for (const c of cols) {
      const well = `${r}${c}`;
      const w = plate.wells[well] || {};
      if (w.status && w.status !== "empty") {
        detailData.push([
          well,
          w.status,
          w.cloneId || "",
          w.sourceWell || "",
          w.replicateNum || "",
          w.value !== undefined ? w.value : "",
        ]);
      }
    }
  }
  const wsDetail = XLSX.utils.aoa_to_sheet(detailData);
  wsDetail["!cols"] = [{ wch: 6 }, { wch: 12 }, { wch: 18 }, { wch: 10 }, { wch: 8 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsDetail, "Details");

  download(wb, `${expId}-${plate.name}.xlsx`);
}

/**
 * Export all plates of an experiment to a single xlsx with multiple sheets
 */
export function exportExperiment(plates, expId) {
  const wb = XLSX.utils.book_new();
  const expPlates = plates.filter((p) => p.expId === expId);

  for (const plate of expPlates) {
    const rows = plate.format === 96 ? ROWS_96 : ROWS_48;
    const cols = plate.format === 96 ? COLS_96 : COLS_48;

    const data = [
      [`${plate.name} (${plate.type}, ${plate.format}-well)`],
      ["", ...cols],
    ];
    for (const r of rows) {
      const row = [r];
      for (const c of cols) {
        const w = plate.wells[`${r}${c}`] || {};
        if (w.value !== undefined) row.push(w.value);
        else if (w.status === "picked") row.push(w.cloneId || "+");
        else if (w.status === "control-wt") row.push("WT");
        else if (w.status === "control-blank") row.push("BL");
        else if (w.status === "dead") row.push("X");
        else row.push("");
      }
      data.push(row);
    }

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws["!cols"] = [{ wch: 4 }, ...cols.map(() => ({ wch: 12 }))];
    XLSX.utils.book_append_sheet(wb, ws, plate.name);
  }

  // Summary sheet with ranking-style data
  const summaryData = [["Clone ID", "Source Well", "Plate", "Status", "Mean OD", "SD", "N"]];
  const cloneMap = {};
  for (const plate of expPlates) {
    for (const [well, w] of Object.entries(plate.wells)) {
      if (w.status === "picked" && w.cloneId && w.cloneId !== "WT") {
        if (!cloneMap[w.cloneId]) cloneMap[w.cloneId] = { sourceWell: w.sourceWell, plate: plate.name, values: [] };
        if (w.value !== undefined) cloneMap[w.cloneId].values.push(w.value);
      }
    }
  }
  for (const [id, d] of Object.entries(cloneMap)) {
    const mean = d.values.length > 0 ? d.values.reduce((a, b) => a + b, 0) / d.values.length : null;
    const sd = d.values.length > 1
      ? Math.sqrt(d.values.reduce((a, v) => a + (v - mean) ** 2, 0) / (d.values.length - 1))
      : null;
    summaryData.push([
      id, d.sourceWell || "", d.plate,
      d.values.length > 0 ? "assayed" : "pending",
      mean, sd, d.values.length || "",
    ]);
  }
  if (summaryData.length > 1) {
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 20 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 5 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
  }

  // Flasks sheet
  const flaskPlates = expPlates.filter((p) => p.type === "flask");
  if (flaskPlates.length > 0) {
    const flaskData = [["Колба", "Clone ID", "Source", "OD", "Активность ГА", "Биомасса", "pH", "Глюкоза", "Время (ч)", "Заметки"]];
    for (const f of flaskPlates) {
      const d = f.flaskData || {};
      flaskData.push([
        f.name, d.cloneId || "", d.sourceWell || "",
        d.od ?? "", d.activity ?? "", d.biomass ?? "",
        d.ph ?? "", d.glucose ?? "", d.time ?? "", d.notes || "",
      ]);
    }
    const wsFlask = XLSX.utils.aoa_to_sheet(flaskData);
    wsFlask["!cols"] = [{ wch: 8 }, { wch: 18 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsFlask, "Flasks");
  }

  download(wb, `${expId}-all.xlsx`);
}
