/**
 * Import colony data from CloneCounter app.
 *
 * Expected format (JSON):
 * {
 *   "source": "CloneCounter",
 *   "plate": "Petri_NTG1",       // petri dish label
 *   "date": "2026-03-22",
 *   "colonies": [
 *     { "well": "A1", "x": 120, "y": 340, "area": 45, "confidence": 0.95 },
 *     { "well": "A3", "x": 280, "y": 340, "area": 62, "confidence": 0.88 },
 *     ...
 *   ]
 * }
 *
 * Returns array of well positions that have colonies (for use as picking map).
 */

export function parseCloneCounterFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data.colonies || !Array.isArray(data.colonies)) {
          reject(new Error("Файл не содержит данных CloneCounter (нет поля colonies)"));
          return;
        }
        const wells = data.colonies
          .map((c) => c.well)
          .filter(Boolean);
        resolve({
          wells,
          plateName: data.plate || "Petri",
          date: data.date || "",
          totalColonies: data.colonies.length,
          source: data.source || "unknown",
        });
      } catch (err) {
        reject(new Error("Невалидный JSON: " + err.message));
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
    reader.readAsText(file);
  });
}

/**
 * Generate CloneCounter export format from a plate (for round-trip testing).
 */
export function generateCloneCounterFormat(plate, expId) {
  const colonies = [];
  for (const [well, w] of Object.entries(plate.wells)) {
    if (w.status === "picked") {
      colonies.push({
        well,
        cloneId: w.cloneId,
        area: 0,
        confidence: 1.0,
      });
    }
  }
  return {
    source: "CloneTracker",
    plate: `${expId}-${plate.name}`,
    date: new Date().toISOString().split("T")[0],
    colonies,
  };
}
