import { useState, useRef, useEffect } from "react";
import { ROWS_96, COLS_96, posToWell } from "../lib/geometry";
import Btn from "./Btn";

export default function PhotoAnalysis({ plateId, onApply, onClose }) {
  const canvasRef = useRef(null);
  const imgRef = useRef(null);
  const [step, setStep] = useState("upload");
  const [image, setImage] = useState(null);
  const [corners, setCorners] = useState([]);
  const [results, setResults] = useState({});
  const [threshold, setThreshold] = useState(128);
  const [canvasSize, setCanvasSize] = useState({ w: 600, h: 400 });

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      setImage(img);
      const maxW = 700, maxH = 500;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      setCanvasSize({ w: Math.round(img.width * scale), h: Math.round(img.height * scale) });
      setStep("calibrate");
    };
    img.src = URL.createObjectURL(file);
  }

  function handleCanvasClick(e) {
    if (step !== "calibrate") return;
    if (corners.length >= 4) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newCorners = [...corners, { x, y }];
    setCorners(newCorners);
    if (newCorners.length === 4) {
      analyzeImage(newCorners, threshold);
    }
  }

  function analyzeImage(calibCorners, thresh) {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgRef.current, 0, 0, canvasSize.w, canvasSize.h);
    const imageData = ctx.getImageData(0, 0, canvasSize.w, canvasSize.h);

    const [tl, tr, br, bl] = calibCorners;
    const res = {};

    for (let ri = 0; ri < 8; ri++) {
      for (let ci = 0; ci < 12; ci++) {
        const u = (ci + 0.5) / 12;
        const v = (ri + 0.5) / 8;
        const px = (1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x);
        const py = (1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y);

        const sampleR = 4;
        let totalBright = 0, count = 0;
        for (let dy = -sampleR; dy <= sampleR; dy++) {
          for (let dx = -sampleR; dx <= sampleR; dx++) {
            const sx = Math.round(px + dx);
            const sy = Math.round(py + dy);
            if (sx < 0 || sy < 0 || sx >= canvasSize.w || sy >= canvasSize.h) continue;
            const idx = (sy * canvasSize.w + sx) * 4;
            const r = imageData.data[idx];
            const g = imageData.data[idx + 1];
            const b = imageData.data[idx + 2];
            totalBright += (r + g + b) / 3;
            count++;
          }
        }
        const avgBright = count > 0 ? totalBright / count : 255;
        res[posToWell(ri, ci)] = avgBright < thresh;
      }
    }
    setResults(res);
    setStep("review");
  }

  function reAnalyze(newThresh) {
    setThreshold(newThresh);
    if (corners.length === 4) analyzeImage(corners, newThresh);
  }

  function toggleWell(well) {
    setResults((prev) => ({ ...prev, [well]: !prev[well] }));
  }

  function handleApply() {
    const picked = Object.entries(results).filter(([, v]) => v).map(([w]) => w);
    const dead = Object.entries(results).filter(([, v]) => !v).map(([w]) => w);
    onApply(plateId, picked, dead);
    onClose();
  }

  // Canvas rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    ctx.drawImage(imgRef.current, 0, 0, canvasSize.w, canvasSize.h);

    ctx.fillStyle = "#10b981";
    for (const c of corners) {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    if (corners.length >= 2) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let i = 0; i < corners.length; i++) {
        const c = corners[i];
        if (i === 0) ctx.moveTo(c.x, c.y);
        else ctx.lineTo(c.x, c.y);
      }
      if (corners.length === 4) ctx.closePath();
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (step === "review" && corners.length === 4) {
      const [tl, tr, br, bl] = corners;
      for (let ri = 0; ri < 8; ri++) {
        for (let ci = 0; ci < 12; ci++) {
          const u = (ci + 0.5) / 12;
          const v = (ri + 0.5) / 8;
          const px = (1 - v) * ((1 - u) * tl.x + u * tr.x) + v * ((1 - u) * bl.x + u * br.x);
          const py = (1 - v) * ((1 - u) * tl.y + u * tr.y) + v * ((1 - u) * bl.y + u * br.y);
          const well = posToWell(ri, ci);
          const hasGrowth = results[well];
          ctx.strokeStyle = hasGrowth ? "#10b981" : "#ef4444";
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px - 7, py - 7, 14, 14);
          if (hasGrowth) {
            ctx.fillStyle = "rgba(16,185,129,0.25)";
            ctx.fillRect(px - 7, py - 7, 14, 14);
          }
        }
      }
    }
  }, [image, corners, results, step, canvasSize]);

  const cornerLabels = ["верх-лево (A1)", "верх-право (A12)", "низ-право (H12)", "низ-лево (H1)"];
  const pickedCount = Object.values(results).filter(Boolean).length;
  const deadCount = Object.values(results).filter((v) => !v).length;

  return (
    <div className="flex flex-col gap-3">
      {step === "upload" && (
        <div className="text-center py-8">
          <div className="text-3xl mb-3">📷</div>
          <label className="inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded cursor-pointer text-xs font-mono transition-colors">
            Загрузить фото
            <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
          </label>
          <div className="text-[10px] text-zinc-600 mt-2">Фото 96-well планшета сверху</div>
        </div>
      )}

      {(step === "calibrate" || step === "review") && (
        <>
          <canvas ref={canvasRef} width={canvasSize.w} height={canvasSize.h}
            onClick={handleCanvasClick}
            className="border border-zinc-700 rounded cursor-crosshair mx-auto block" />

          {step === "calibrate" && (
            <div className="text-[11px] text-zinc-400">
              Кликни по углам планшета ({corners.length}/4):
              {corners.length < 4 && (
                <span className="text-emerald-500 ml-1 font-bold">{cornerLabels[corners.length]}</span>
              )}
              {corners.length > 0 && (
                <Btn small variant="ghost" className="ml-2" onClick={() => setCorners([])}>Сброс</Btn>
              )}
            </div>
          )}

          {step === "review" && (
            <>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-zinc-500">Порог:</span>
                <input type="range" min="30" max="230" value={threshold}
                  onChange={(e) => reAnalyze(Number(e.target.value))}
                  className="flex-1 accent-emerald-500" />
                <span className="text-[10px] text-zinc-400 w-8">{threshold}</span>
              </div>

              <div className="text-[11px] text-zinc-400">
                Рост: <b className="text-emerald-500">{pickedCount}</b>
                {" / "}Пусто: <b className="text-red-500">{deadCount}</b>
                <span className="text-zinc-600 ml-2">· кликни для коррекции</span>
              </div>

              {/* Mini correction grid */}
              <div className="flex justify-center">
                <svg width={312} height={216}
                  style={{ fontFamily: "'JetBrains Mono',monospace", userSelect: "none" }}>
                  {COLS_96.map((c, ci) => (
                    <text key={ci} x={20 + ci * 24 + 12} y={10}
                      textAnchor="middle" fill="#71717a" fontSize={7}>{c}</text>
                  ))}
                  {ROWS_96.map((r, ri) => (
                    <text key={ri} x={10} y={18 + ri * 24 + 12 + 3}
                      textAnchor="middle" fill="#71717a" fontSize={7}>{r}</text>
                  ))}
                  {ROWS_96.map((r, ri) =>
                    COLS_96.map((c, ci) => {
                      const well = `${r}${c}`;
                      const hasGrowth = results[well];
                      return (
                        <rect key={well}
                          x={20 + ci * 24} y={18 + ri * 24}
                          width={22} height={22} rx={2}
                          fill={hasGrowth ? "#059669" : "#7f1d1d"}
                          stroke={hasGrowth ? "#10b981" : "#991b1b"}
                          strokeWidth={0.5}
                          style={{ cursor: "pointer" }}
                          onClick={() => toggleWell(well)} />
                      );
                    })
                  )}
                </svg>
              </div>

              <div className="flex justify-end gap-1.5">
                <Btn variant="secondary" onClick={() => { setCorners([]); setStep("calibrate"); }}>
                  Перекалибровка
                </Btn>
                <Btn onClick={handleApply}>
                  Применить ({pickedCount} кл.)
                </Btn>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
