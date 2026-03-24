import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { ROWS_96, COLS_96, ROWS_48, COLS_48, PLATE_TYPES } from "../lib/geometry";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

const LABEL_W_MM = 57;
const LABEL_H_MM = 40;
const PRINT_DPI = 300;
const PX_PER_MM = PRINT_DPI / 25.4;
const CANVAS_W = Math.round(LABEL_W_MM * PX_PER_MM);
const CANVAS_H = Math.round(LABEL_H_MM * PX_PER_MM);

export default function LabelPrint({ plate, expId, onClose }) {
  const { isDark } = useTheme();
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  const rows = plate.format === 96 ? ROWS_96 : ROWS_48;
  const cols = plate.format === 96 ? COLS_96 : COLS_48;
  const plateId = plate.id;
  const plateName = plate.name;
  const plateType = PLATE_TYPES[plate.type]?.label || plate.type;
  const pickedWells = Object.entries(plate.wells).filter(([, w]) => w.status === "picked");
  const cloneCount = pickedWells.length;
  const date = plate.created ? plate.created.split("T")[0] : "";

  // Calculate filled range (e.g. "A1–C9")
  const filledRange = (() => {
    if (pickedWells.length === 0) return "";
    const positions = pickedWells.map(([well]) => ({
      row: well.charCodeAt(0) - 65,
      col: parseInt(well.slice(1)),
    }));
    const minRow = Math.min(...positions.map((p) => p.row));
    const maxRow = Math.max(...positions.map((p) => p.row));
    const minCol = Math.min(...positions.map((p) => p.col));
    const maxCol = Math.max(...positions.map((p) => p.col));
    return `${String.fromCharCode(65 + minRow)}${minCol}–${String.fromCharCode(65 + maxRow)}${maxCol}`;
  })();

  // QR data: plate ID + clone layout (compact JSON)
  const qrPayload = JSON.stringify({
    id: plateId,
    exp: expId,
    name: plateName,
    fmt: plate.format,
    date,
    n: cloneCount,
    range: filledRange,
    clones: pickedWells.reduce((acc, [well, w]) => {
      acc[well] = w.cloneId || "+";
      return acc;
    }, {}),
  });

  useEffect(() => {
    let mounted = true;
    renderLabel().then(() => { if (!mounted) return; });
    return () => { mounted = false; };
  }, [plate]);

  async function renderLabel() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const mm = (v) => Math.round(v * PX_PER_MM);

    // White background
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    const pad = mm(2.5);

    // ── Layout: QR top-left, Text top-right, Map bottom-right ──

    // QR Code (top-left)
    const qrSize = mm(15);
    try {
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        width: qrSize, margin: 0,
        color: { dark: "#000000", light: "#ffffff" },
      });
      const qrImg = new Image();
      await new Promise((resolve) => { qrImg.onload = resolve; qrImg.src = qrDataUrl; });
      ctx.drawImage(qrImg, pad, pad, qrSize, qrSize);
    } catch (e) {
      ctx.strokeStyle = "#000";
      ctx.strokeRect(pad, pad, qrSize, qrSize);
    }

    // ── Text (right of QR, top area) ──
    const textX = pad + qrSize + mm(2);

    ctx.fillStyle = "#000";
    ctx.textBaseline = "top";
    ctx.textAlign = "left";

    // Line 1: Experiment ID — largest
    ctx.font = `bold ${mm(4.5)}px 'Arial', sans-serif`;
    ctx.fillText(expId, textX, pad);

    // Line 2: Plate name + type
    ctx.font = `bold ${mm(3.5)}px 'Arial', sans-serif`;
    ctx.fillText(`${plateName} · ${plateType}`, textX, pad + mm(5.5));

    // Line 3: Stats
    ctx.font = `${mm(2.5)}px 'Arial', sans-serif`;
    ctx.fillText(`${cloneCount} кл. | ${filledRange || "—"} | ${plate.format}-well | ${date}`, textX, pad + mm(10));

    // Line 4: Full ID (small)
    ctx.font = `${mm(2)}px 'Arial', sans-serif`;
    ctx.fillStyle = "#555";
    ctx.fillText(plateId, textX, pad + mm(13.5));

    // ── Plate map (bottom-right corner) — B&W with patterns ──
    const nCols = cols.length;
    const nRows = rows.length;

    // Map anchored to bottom-right
    const mapPad = mm(1);
    const labelSpace = mm(2.5); // space for row/col labels

    // Available space for map in bottom-right
    const mapMaxW = CANVAS_W - pad - mapPad - labelSpace;
    const mapMaxH = CANVAS_H - pad - qrSize - mm(2) - mapPad - labelSpace;

    let cellW, cellH;
    if (plate.format === 48) {
      cellW = Math.min(Math.floor((mapMaxW) / nCols), mm(4));
      cellH = Math.min(Math.floor((mapMaxH) / nRows), mm(2.2));
    } else {
      const cs = Math.min(Math.floor(mapMaxW / nCols), Math.floor(mapMaxH / nRows), mm(2));
      cellW = cs;
      cellH = cs;
    }

    const mapW = nCols * cellW;
    const mapH = nRows * cellH;
    // Bottom-right anchor
    const mapX = CANVAS_W - pad - mapW;
    const mapY = CANVAS_H - pad - mapH;

    // B&W patterns for statuses
    for (let ri = 0; ri < nRows; ri++) {
      for (let ci = 0; ci < nCols; ci++) {
        const well = `${rows[ri]}${cols[ci]}`;
        const w = plate.wells[well] || { status: "empty" };
        const wx = mapX + ci * cellW;
        const wy = mapY + ri * cellH;

        // Cell border
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 0.5;
        ctx.strokeRect(wx, wy, cellW, cellH);

        if (w.status === "picked") {
          // Filled black
          ctx.fillStyle = "#000";
          ctx.fillRect(wx + 0.5, wy + 0.5, cellW - 1, cellH - 1);
        } else if (w.status === "control-wt") {
          // Diagonal hatch
          ctx.fillStyle = "#fff";
          ctx.fillRect(wx + 0.5, wy + 0.5, cellW - 1, cellH - 1);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(wx, wy);
          ctx.lineTo(wx + cellW, wy + cellH);
          ctx.moveTo(wx + cellW, wy);
          ctx.lineTo(wx, wy + cellH);
          ctx.stroke();
        } else if (w.status === "control-blank") {
          // Dotted (center dot)
          ctx.fillStyle = "#fff";
          ctx.fillRect(wx + 0.5, wy + 0.5, cellW - 1, cellH - 1);
          ctx.fillStyle = "#000";
          ctx.beginPath();
          ctx.arc(wx + cellW / 2, wy + cellH / 2, Math.min(cellW, cellH) * 0.2, 0, Math.PI * 2);
          ctx.fill();
        } else if (w.status === "dead") {
          // X mark
          ctx.fillStyle = "#fff";
          ctx.fillRect(wx + 0.5, wy + 0.5, cellW - 1, cellH - 1);
          ctx.strokeStyle = "#000";
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(wx + 2, wy + 2);
          ctx.lineTo(wx + cellW - 2, wy + cellH - 2);
          ctx.moveTo(wx + cellW - 2, wy + 2);
          ctx.lineTo(wx + 2, wy + cellH - 2);
          ctx.stroke();
        }
        // empty = just border, white inside
      }
    }

    // Row labels (left of map)
    ctx.fillStyle = "#000";
    ctx.font = `${mm(1.5)}px 'Arial', sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    for (let ri = 0; ri < nRows; ri++) {
      ctx.fillText(rows[ri], mapX - mm(0.8), mapY + ri * cellH + cellH / 2);
    }
    // Col labels (above map)
    ctx.textBaseline = "bottom";
    ctx.textAlign = "center";
    for (let ci = 0; ci < nCols; ci++) {
      ctx.fillText(String(cols[ci]), mapX + ci * cellW + cellW / 2, mapY - mm(0.5));
    }

    // ── Legend below QR (bottom-left) ──
    const legY = CANVAS_H - pad - mm(8);
    const legX = pad;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    ctx.font = `${mm(1.8)}px 'Arial', sans-serif`;
    ctx.fillStyle = "#000";

    const legItems = [
      ["■", "Клон"],
      ["╳", "WT"],
      ["●", "Blank"],
      ["✗", "Dead"],
      ["□", "Пусто"],
    ];
    let ly = legY;
    for (const [sym, label] of legItems) {
      ctx.fillText(`${sym} ${label}`, legX, ly);
      ly += mm(2.2);
    }

    // Border
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, CANVAS_W - 2, CANVAS_H - 2);

    setReady(true);
  }

  function handlePrint() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>Этикетка ${plateId}</title>
<style>
  @page { size: ${LABEL_W_MM}mm ${LABEL_H_MM}mm; margin: 0; }
  body { margin: 0; padding: 0; }
  img { width: ${LABEL_W_MM}mm; height: ${LABEL_H_MM}mm; }
</style></head><body>
<img src="${dataUrl}" />
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    win.document.close();
  }

  function handleSavePng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `label-${plateId}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  function handlePrintA4() {
    const nCols = cols.length;
    const nRows = rows.length;
    const is48 = plate.format === 48;

    let tableRows = "";
    for (let ri = 0; ri < nRows; ri++) {
      let cells = `<td style="font-weight:bold;text-align:center;padding:2px 4px;background:#f9fafb;">${rows[ri]}</td>`;
      for (let ci = 0; ci < nCols; ci++) {
        const well = `${rows[ri]}${cols[ci]}`;
        const w = plate.wells[well] || { status: "empty" };
        let text = "", bg = "#fff";
        if (w.status === "picked" && w.cloneId) {
          const parts = w.cloneId.split("-");
          text = parts.length >= 3 ? parts[parts.length - 1] : w.cloneId;
          if (w.replicateNum && w.replicateNum > 1) text = `r${w.replicateNum}`;
          if (w.replicateNum === 1 && w.sourceWell) text = w.sourceWell;
          bg = "#d1fae5";
        } else if (w.status === "control-wt") { text = "WT"; bg = "#fef3c7"; }
        else if (w.status === "control-blank") { text = "BL"; bg = "#e4e4e7"; }
        else if (w.status === "dead") { text = "✗"; bg = "#fecaca"; }
        if (w.value !== undefined) text += (text ? "\\n" : "") + w.value.toFixed(2);
        cells += `<td style="background:${bg};text-align:center;padding:${is48 ? "4px 6px" : "2px 3px"};font-size:${is48 ? "9pt" : "7pt"};border:1px solid #bbb;white-space:pre-line;">${text}</td>`;
      }
      tableRows += `<tr>${cells}</tr>`;
    }

    let colHeaders = '<th style="background:#f9fafb;"></th>';
    for (let ci = 0; ci < nCols; ci++) {
      colHeaders += `<th style="text-align:center;padding:2px 4px;font-weight:bold;background:#f9fafb;border:1px solid #bbb;font-size:8pt;">${cols[ci]}</th>`;
    }

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>${plateId}</title>
<style>
  @page { size: A4 ${is48 ? "landscape" : "portrait"}; margin: 10mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 10mm; color: #18181b; }
  h1 { font-size: 16pt; margin: 0 0 2mm; }
  .meta { font-size: 9pt; color: #71717a; margin-bottom: 5mm; }
  table { border-collapse: collapse; margin: 0 auto; }
  .legend { display: flex; gap: 12px; margin-top: 5mm; font-size: 8pt; justify-content: center; }
  .legend span { display: inline-flex; align-items: center; gap: 3px; }
  .swatch { display: inline-block; width: 10px; height: 10px; border: 1px solid #ccc; }
</style></head><body>
<h1>${expId} — ${plateName} (${plateType})</h1>
<div class="meta">${plate.format}-well · ${cloneCount} клонов · ${date} · ${plateId}</div>
<table>
  <thead><tr>${colHeaders}</tr></thead>
  <tbody>${tableRows}</tbody>
</table>
<div class="legend">
  <span><span class="swatch" style="background:#d1fae5;"></span> Клон</span>
  <span><span class="swatch" style="background:#fef3c7;"></span> WT</span>
  <span><span class="swatch" style="background:#e4e4e7;"></span> Blank</span>
  <span><span class="swatch" style="background:#fecaca;"></span> Dead</span>
  <span><span class="swatch" style="background:#fff;border:1px solid #ccc;"></span> Пусто</span>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
    win.document.close();
  }

  const previewScale = 400 / CANVAS_W;

  return (
    <div className="flex flex-col gap-3 items-center">
      <div className={`border ${isDark ? "border-zinc-700" : "border-zinc-300"} rounded overflow-hidden bg-white`}
        style={{ width: CANVAS_W * previewScale, height: CANVAS_H * previewScale }}>
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H}
          style={{ width: "100%", height: "100%", display: "block" }} />
      </div>

      <div className={`text-[9px] ${isDark ? "text-zinc-600" : "text-zinc-500"} text-center`}>
        {LABEL_W_MM}×{LABEL_H_MM} мм · ч/б · 300 DPI
      </div>

      <div className="flex gap-2 flex-wrap justify-center">
        <Btn onClick={handlePrint} disabled={!ready}>🏷 Этикетка</Btn>
        <Btn variant="secondary" onClick={handleSavePng} disabled={!ready}>💾 PNG</Btn>
        <Btn variant="secondary" onClick={handlePrintA4}>📄 Карта A4</Btn>
      </div>
    </div>
  );
}
