const variants = {
  primary: "bg-emerald-600 hover:bg-emerald-500 text-white",
  secondary: "bg-zinc-700 hover:bg-zinc-600 text-zinc-300",
  danger: "bg-red-900 hover:bg-red-700 text-white",
  ghost: "bg-transparent hover:bg-zinc-800 text-zinc-500",
};

export default function Btn({ children, onClick, variant = "primary", disabled, small, className = "" }) {
  const base = "border-none rounded font-medium font-mono transition-colors duration-150 cursor-pointer";
  const size = small ? "px-2 py-0.5 text-[10px]" : "px-3 py-1.5 text-xs";
  const dis = disabled ? "!bg-zinc-800 !text-zinc-600 !cursor-not-allowed" : "";
  const v = variants[variant] || variants.primary;

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${size} ${v} ${dis} ${className}`}
    >
      {children}
    </button>
  );
}
