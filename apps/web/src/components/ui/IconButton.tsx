import type { ReactNode } from "react";

export function IconButton({
  children,
  label,
  active = false,
  disabled = false,
  title,
  onClick,
}: {
  children: ReactNode;
  label?: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-md transition-colors ${
        disabled
          ? "cursor-not-allowed text-text-dim opacity-50"
          : active
            ? "bg-surface text-blue"
            : "text-text-muted hover:text-text hover:bg-surface"
      }`}
    >
      {children}
    </button>
  );
}
