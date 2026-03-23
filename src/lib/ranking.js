export function computeRanking(plates, expId) {
  const culturePlates = plates.filter(p => p.expId === expId && p.type === "culture");
  const cloneMap = {};
  const wtValues = [];

  for (const pl of culturePlates) {
    for (const [, d] of Object.entries(pl.wells)) {
      if (d.value === undefined) continue;
      if (d.status === "control-wt") {
        wtValues.push(d.value);
      } else if (d.status === "picked" && d.cloneId) {
        if (!cloneMap[d.cloneId])
          cloneMap[d.cloneId] = { values: [], sourceWell: d.sourceWell, plate: pl.name };
        cloneMap[d.cloneId].values.push(d.value);
      }
    }
  }

  const wtMean = wtValues.length > 0
    ? wtValues.reduce((a, b) => a + b, 0) / wtValues.length
    : 1;

  const ranked = Object.entries(cloneMap)
    .map(([id, d]) => {
      const mean = d.values.reduce((a, b) => a + b, 0) / d.values.length;
      const std = d.values.length > 1
        ? Math.sqrt(d.values.reduce((a, v) => a + (v - mean) ** 2, 0) / (d.values.length - 1))
        : 0;
      const cv = mean > 0 ? (std / mean) * 100 : 0;
      return {
        cloneId: id,
        mean,
        std,
        cv,
        cvWarning: cv > 30, // CV > 30% is suspicious for triplicate assay
        n: d.values.length,
        ratio: mean / wtMean,
        sourceWell: d.sourceWell,
        plate: d.plate,
      };
    })
    .sort((a, b) => b.mean - a.mean);

  return { ranked, wtMean, wtN: wtValues.length };
}
