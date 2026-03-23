export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-zinc-900 border border-zinc-700 rounded-lg ${wide ? "max-w-3xl" : "max-w-xl"} w-full max-h-[90vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center px-4 py-3 border-b border-zinc-700">
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
          <button
            onClick={onClose}
            className="bg-transparent border-none text-zinc-500 cursor-pointer text-lg"
          >
            ✕
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
