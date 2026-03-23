export const INPUT_DARK =
  "w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-zinc-200 font-mono outline-none mt-1 box-border";
export const INPUT_LIGHT =
  "w-full bg-white border border-zinc-300 rounded px-2.5 py-1.5 text-xs text-zinc-800 font-mono outline-none mt-1 box-border";
export function inputClass(isDark) { return isDark ? INPUT_DARK : INPUT_LIGHT; }
