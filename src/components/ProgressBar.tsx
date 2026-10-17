interface ProgressBarProps {
  value: number; // 0-100
  accent?: string;
  className?: string;
}

export default function ProgressBar({ value, accent, className = "" }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-panel-2 ${className}`}>
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${clamped}%`, backgroundColor: accent ?? "var(--accent)" }}
      />
    </div>
  );
}
