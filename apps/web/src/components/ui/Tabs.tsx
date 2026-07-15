export function TextTabs({
  items,
  active,
  onChange,
  size = "sm",
}: {
  items: string[];
  active: string;
  onChange?: (v: string) => void;
  size?: "sm" | "md";
}) {
  const textSize = size === "md" ? "text-[13px]" : "text-[13px]";

  return (
    <div className="flex items-center gap-5">
      {items.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange?.(item)}
            className={`${textSize} font-medium transition-colors ${
              isActive ? "text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}

export function SegmentedControl({
  items,
  active,
  onChange,
}: {
  items: string[];
  active: string;
  onChange?: (v: string) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md bg-surface p-0.5">
      {items.map((item) => {
        const isActive = item === active;
        return (
          <button
            key={item}
            type="button"
            onClick={() => onChange?.(item)}
            className={`rounded-[5px] px-3 py-1 text-[12px] font-medium transition-colors ${
              isActive ? "bg-surface-2 text-text" : "text-text-muted hover:text-text"
            }`}
          >
            {item}
          </button>
        );
      })}
    </div>
  );
}
