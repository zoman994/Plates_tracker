import { useState, useRef, useEffect, useCallback } from "react";
import { ROWS_96, COLS_96, posToWell } from "../lib/geometry";
import { useTheme } from "../lib/ThemeContext";
import Btn from "./Btn";

const NROWS = 8;
const NCOLS = 12;

function detectPitch(imageData, w, h, cx, cy) {
  const getB = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 255;
    const i = (y * w + x) * 4;
    return (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
  };
  const avg = (x, y, r) => {
    let sum = 0, n = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) { sum += getB(x + dx, y + dy); n++; }
    return sum / n;
  };
  const centerB = avg(cx, cy, 3);
  const scanDir = (dx, dy) => {
    let passedGap = false, gapMax = centerB;
    for (let d = 5; d < 150; d++) {
      const b = avg(cx + dx * d, cy + dy * d, 2);
      if (!passedGap) {
        if (b > centerB + 20) { passedGap = true; gapMax = b; }
      } else {
        if (b < gapMax - 20) {
          let minB = b, minD = d;
          for (let d2 = d; d2 < d + 40 && d2 < 180; d2++) {
            const b2 = avg(cx + dx * d2, cy + dy * d2, 2);
            if (b2 < minB) { minB = b2; minD = d2; }
            else if (b2 > minB + 15) break;
          }
          return minD;
        }
      }
    }
    return null;
  };
  const pitches = [scanDir(1, 0), scanDir(0, 1), scanDir(-1, 0), scanDir(0, -1)].filter(Boolean);
  if (pitches.length === 0) return 45;
  pitches.sort((a, b) => a - b);
  return pitches[Math.floor(pitches.length / 2)];
}

function analyzePlate(imageData, w, h, a1x, a1y, pitch, wellFrac, thresholdIn) {
  const sampleR = Math.max(2, Math.round(pitch * wellFrac / 2));
  const getB = (x, y) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return 255;
    const i = (y * w + x) * 4;
    return (imageData[i] + imageData[i + 1] + imageData[i + 2]) / 3;
  };
  const sampleWell = (cx, cy) => {
    let sum = 0, n = 0;
    for (let dy = -sampleR; dy <= sampleR; dy++)
      for (let dx = -sampleR; dx <= sampleR; dx++) { sum += getB(cx + dx, cy + dy); n++; }
    return n > 0 ? sum / n : 255;
  };
  const grid = {}, brightness = {};
  for (let ri = 0; ri < NROWS; ri++)
    for (let ci = 0; ci < NCOLS; ci++) {
      const well = posToWell(ri, ci);
      grid[well] = { x: Math.round(a1x + ri * pitch), y: Math.round(a1y + ci * pitch) };
      brightness[well] = sampleWell(grid[well].x, grid[well].y);
    }
  let threshold = thresholdIn;
  if (threshold === null) {
    const vals = Object.values(brightness);
    const lo = Math.min(...vals), hi = Math.max(...vals);
    let bestT = (lo + hi) / 2, bestVar = 0;
    for (let t = lo; t <= hi; t += 0.5) {
      const g0 = vals.filter(v => v <= t), g1 = vals.filter(v => v > t);
      if (!g0.length || !g1.length) continue;
      const m0 = g0.reduce((a, b) => a + b) / g0.length;
      const m1 = g1.reduce((a, b) => a + b) / g1.length;
      const v = g0.length * g1.length * (m0 - m1) ** 2;
      if (v > bestVar) { bestVar = v; bestT = t; }
    }
    threshold = bestT;
  }
  const results = {};
  for (const well of Object.keys(grid)) results[well] = brightness[well] < threshold;
  return { grid, brightness, results, threshold };
}

export default function PhotoAnalysis({ plateId, onApply, onClose }) {
  const { isDark } = useTheme();
  const canvasRef = useRef(null);
  const overlayRef = useRef(null);
  const imgRef = useRef(null);
  const imageDataRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [canvasSize, setCanvasSize] = useState({ w: 700, h: 500 });
  const [a1, setA1] = useState(null);
  const [pitch, setPitch] = useState(45);
  const [wellFrac, setWellFrac] = useState(0.7);
  const [threshold, setThreshold] = useState(null);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [analysis, setAnalysis] = useState(null);
  const [manualOverrides, setManualOverrides] = useState({});
  const deadFill = isDark ? "#7f1d1d" : "#fecaca";
  const deadStroke = isDark ? "#991b1b" : "#f87171";

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const im = new Image();
    im.onload = () => {
      imgRef.current = im;
      const maxW = 750, maxH = 550;
      const scale = Math.min(maxW / im.width, maxH / im.height, 1);
      setCanvasSize({ w: Math.round(im.width * scale), h: Math.round(im.height * scale) });
      setStep("calibrate");
    };
    im.src = URL.createObjectURL(file);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current || step === "upload") return;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgRef.current, 0, 0, canvasSize.w, canvasSize.h);
    imageDataRef.current = ctx.getImageData(0, 0, canvasSize.w, canvasSize.h);
  }, [canvasSize, step]);

  function handleCanvasClick(e) {
    if (step !== "calibrate") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round(e.clientX - rect.left);
    const y = Math.round(e.clientY - rect.top);
    const idata = imageDataRef.current;
    if (!idata) return;
    const detectedPitch = detectPitch(idata.data, canvasSize.w, canvasSize.h, x, y);
    setA1({ x, y });
    setPitch(detectedPitch);
    setOffsetX(0); setOffsetY(0);
    setThreshold(null); setManualOverrides({});
    setStep("review");
  }

  const runAnalysis = useCallback(() => {
    if (!a1 || !imageDataRef.current) return;
    const result = analyzePlate(
      imageDataRef.current.data, canvasSize.w, canvasSize.h,
      a1.x + offsetX, a1.y + offsetY, pitch, wellFrac, threshold
    );
    const merged = { ...result.results, ...manualOverrides };
    setAnalysis({ ...result, results: merged });
    if (threshold === null) setThreshold(result.threshold);
  }, [a1, pitch, wellFrac, threshold, offsetX, offsetY, canvasSize, manualOverrides]);

  useEffect(() => { if (step === "review") runAnalysis(); }, [step, runAnalysis]);

  useEffect(() => {
    const canvas = overlayRef.current;
    if (!canvas || !analysis) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    const half = Math.round(pitch * wellFrac / 2);
    for (const [well, { x, y }] of Object.entries(analysis.grid)) {
      const hasGrowth = analysis.results[well];
      const isOverride = well in manualOverrides;
      ctx.strokeStyle = hasGrowth ? "#10b981" : "#ef4444";
      ctx.lineWidth = isOverride ? 3 : 2;
      ctx.strokeRect(x - half, y - half, half * 2, half * 2);
      if (hasGrowth) {
        ctx.fillStyle = "rgba(16,185,129,0.15)";
        ctx.fillRect(x - half, y - half, half * 2, half * 2);
      }
    }
    const a1pos = analysis.grid["A1"];
    if (a1pos) {
      ctx.fillStyle = "#facc15";
      ctx.beginPath(); ctx.arc(a1pos.x, a1pos.y, 5, 0, Math.PI * 2); ctx.fill();
      ctx.font = "bold 11px monospace";
      ctx.fillText("A1", a1pos.x - 8, a1pos.y - 10);
    }
  }, [analysis, canvasSize, pitch, wellFrac, manualOverrides]);

  function handleOverlayClick(e) {
    if (step !== "review" || !analysis) return;
    const rect = overlayRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let closest = null, closestDist = Infinity;
    for (const [well, { x, y }] of Object.entries(analysis.grid)) {
      const d = Math.hypot(mx - x, my - y);
      if (d < closestDist && d < pitch * 0.6) { closest = well; closestDist = d; }
    }
    if (closest) setManualOverrides(prev => ({ ...prev, [closest]: !analysis.results[closest] }));
  }

  function handleApply() {
    if (!analysis) return;
    const picked = Object.entries(analysis.results).filter(([, v]) => v).map(([w]) => w);
    const dead = Object.entries(analysis.results).filter(([, v]) => !v).map(([w]) => w);
    onApply(plateId, picked, dead);
    onClose();
  }

  function handleRecalibrate() {
    setA1(null); setAnalysis(null); setManualOverrides({}); setThreshold(null); setStep("calibrate");
  }

  const debounceRef = useRef(null);
  function debouncedSet(setter, value) {
    setter(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runAnalysis, 80);
  }

  const pickedCount = analysis ? Object.values(analysis.results).filter(Boolean).length : 0;
  const deadCount = analysis ? Object.values(analysis.results).filter(v => !v).length : 0;
  const miniS = 22, miniLW = 18, miniLH = 14;

  return (
    <div className="flex flex-col gap-3">
      {step === "upload" && (
        <div className="text-center py-8">
          <div className="text-3xl mb-3">📷</div>
          <label className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer text-xs font-mono transition-colors">
            Загрузить фото
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <div className={`text-[10px] ${isDark ? "text-zinc-600" : "text-zinc-500"} mt-2`}>
            Фото 96-well планшета (трансиллюминатор, сканер, телефон сверху)
          </div>
        </div>
      )}

      {step === "calibrate" && (
        <>
          <div style={{ position: "relative", width: canvasSize.w, height: canvasSize.h, margin: "0 auto" }}>
            <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
              onClick={handleCanvasClick}
              className={`border ${isDark ? "border-zinc-700" : "border-zinc-300"} rounded cursor-crosshair block`} />
          </div>
          <div className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"} text-center`}>
            <span className="text-emerald-500 font-bold">Кликни на центр лунки A1</span>
            <span className="ml-1">(верхний левый угол планшета)</span>
          </div>
        </>
      )}

      {step === "review" && analysis && (
        <>
          <div style={{ position: "relative", width: canvasSize.w, height: canvasSize.h, margin: "0 auto" }}>
            <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
              className={`border ${isDark ? "border-zinc-700" : "border-zinc-300"} rounded block`}
              style={{ position: "absolute", top: 0, left: 0 }} />
            <canvas ref={overlayRef} width={canvasSize.w} height={canvasSize.h}
              onClick={handleOverlayClick}
              style={{ position: "absolute", top: 0, left: 0, cursor: "pointer" }} />
          </div>

          <div className={`grid grid-cols-2 gap-x-4 gap-y-1.5 text-[10px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[9px]">Шаг (pitch)</span>
              <input type="range" min="20" max="80" step="0.5" value={pitch}
                onChange={e => debouncedSet(setPitch, Number(e.target.value))}
                className="flex-1 accent-emerald-500" />
              <span className="w-10 text-right font-bold">{pitch.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[9px]">Размер лунки</span>
              <input type="range" min="0.3" max="0.95" step="0.05" value={wellFrac}
                onChange={e => debouncedSet(setWellFrac, Number(e.target.value))}
                className="flex-1 accent-emerald-500" />
              <span className="w-10 text-right font-bold">{Math.round(wellFrac * 100)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[9px]">Порог яркости</span>
              <input type="range" min="30" max="230" step="1" value={threshold ?? 128}
                onChange={e => debouncedSet(setThreshold, Number(e.target.value))}
                className="flex-1 accent-emerald-500" />
              <span className="w-10 text-right font-bold">{Math.round(threshold ?? 128)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-20 text-[9px]">Сдвиг сетки</span>
              <div className="flex gap-0.5">
                {[["←", () => debouncedSet(setOffsetX, offsetX - 2)],
                  ["→", () => debouncedSet(setOffsetX, offsetX + 2)],
                  ["↑", () => debouncedSet(setOffsetY, offsetY - 2)],
                  ["↓", () => debouncedSet(setOffsetY, offsetY + 2)],
                  ["⊙", () => { debouncedSet(setOffsetX, 0); setOffsetY(0); }],
                ].map(([label, fn]) => (
                  <button key={label} onClick={fn}
                    className={`px-1.5 py-0.5 rounded border text-[9px] font-mono cursor-pointer ${
                      isDark ? "border-zinc-700 text-zinc-400 hover:bg-zinc-800" : "border-zinc-300 text-zinc-600 hover:bg-zinc-100"
                    }`}>{label}</button>
                ))}
              </div>
              <span className="text-[9px] text-zinc-600 ml-1">({offsetX},{offsetY})</span>
            </div>
          </div>

          <div className={`text-[11px] ${isDark ? "text-zinc-400" : "text-zinc-600"}`}>
            Рост: <b className="text-emerald-500">{pickedCount}</b>
            {" / "}Пусто: <b className="text-red-500">{deadCount}</b>
            {Object.keys(manualOverrides).length > 0 && (
              <span className="text-amber-500 ml-2">({Object.keys(manualOverrides).length} правок)</span>
            )}
            <span className={`${isDark ? "text-zinc-700" : "text-zinc-400"} ml-2 text-[9px]`}>
              клик по фото/сетке = переключить лунку
            </span>
          </div>

          <div className="flex justify-center">
            <svg width={miniLW + NROWS * miniS} height={miniLH + NCOLS * miniS}
              style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
              {ROWS_96.map((r, ri) => (
                <text key={ri} x={miniLW + ri * miniS + miniS / 2} y={10}
                  textAnchor="middle" fill="#71717a" fontSize={8}>{r}</text>
              ))}
              {COLS_96.map((c, ci) => (
                <text key={ci} x={10} y={miniLH + ci * miniS + miniS / 2 + 3}
                  textAnchor="middle" fill="#71717a" fontSize={7}>{c}</text>
              ))}
              {ROWS_96.map((r, ri) =>
                COLS_96.map((c, ci) => {
                  const well = `${r}${c}`;
                  const hasGrowth = analysis.results[well];
                  const isOverride = well in manualOverrides;
                  return (
                    <rect key={well}
                      x={miniLW + ri * miniS} y={miniLH + ci * miniS}
                      width={miniS - 1} height={miniS - 1} rx={2}
                      fill={hasGrowth ? "#059669" : deadFill}
                      stroke={isOverride ? "#facc15" : hasGrowth ? "#10b981" : deadStroke}
                      strokeWidth={isOverride ? 2 : 0.5}
                      style={{ cursor: "pointer" }}
                      onClick={() => setManualOverrides(prev => ({ ...prev, [well]: !analysis.results[well] }))} />
                  );
                })
              )}
            </svg>
          </div>

          <div className="flex justify-between items-center">
            <Btn small variant="ghost" onClick={handleRecalibrate}>↩ Перекалибровка</Btn>
            <div className="flex gap-1.5">
              <Btn variant="secondary" onClick={onClose}>Отмена</Btn>
              <Btn onClick={handleApply}>Применить ({pickedCount} кл.)</Btn>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
