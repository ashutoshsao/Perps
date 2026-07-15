import type { ReactNode } from "react";

export function Pill({
  children,
  tone = "blue",
}: {
  children: ReactNode;
  tone?: "blue" | "neutral";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-blue/15 text-blue"
      : "bg-surface-2 text-text-muted";

  return (
    <span
      className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-none ${toneClass}`}
    >
      {children}
    </span>
  );
}
