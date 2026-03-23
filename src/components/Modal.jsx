import { useTheme } from "../lib/ThemeContext";

export default function Modal({ open, onClose, title, children, wide }) {
  const { isDark } = useTheme();
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`${isDark ? "bg-zinc-900 border-zinc-700" : "bg-white border-zinc-200"} border rounded-lg ${wide ? "max-w-3xl" : "max-w-xl"} w-full max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`flex justify-between items-center px-4 py-3 border-b ${isDark ? "border-zinc-700" : "border-zinc-200"}`}>
          <span className={`text-sm font-semibold ${isDark ? "text-zinc-200" : "text-zinc-900"}`}>{title}</span>
          <button
            onClick={onClose}
            className={`bg-transparent border-none cursor-pointer text-lg ${isDark ? "text-zinc-500" : "text-zinc-400"}`}
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
