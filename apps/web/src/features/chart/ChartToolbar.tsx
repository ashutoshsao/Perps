import { useEffect, useRef, useState } from "react";
import {
  CameraIcon,
  CandlesIcon,
  ChevronDownIcon,
  ExpandIcon,
  GearIcon,
  IndicatorsIcon,
  MagnetIcon,
  RedoIcon,
  UndoIcon,
} from "../../icons";
import { IconButton } from "../../components/ui/IconButton";
import { chartIntervals } from "../../lib/constants";
import type { ChartInterval } from "../../hooks/useLiveCandles";

function useClickOutside<T extends HTMLElement>(onOutside: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function ChartToolbar({
  interval,
  onIntervalChange,
  showVolume,
  onToggleVolume,
  onFullscreen,
  onReset,
}: {
  interval: ChartInterval;
  onIntervalChange: (interval: ChartInterval) => void;
  showVolume: boolean;
  onToggleVolume: () => void;
  onFullscreen: () => void;
  onReset: () => void;
}) {
  const [tfOpen, setTfOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const tfRef = useClickOutside<HTMLDivElement>(() => setTfOpen(false));
  const settingsRef = useClickOutside<HTMLDivElement>(() => setSettingsOpen(false));

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-border-soft px-3">
      <div className="flex shrink-0 items-center gap-1">
        <div className="relative" ref={tfRef}>
          <button
            type="button"
            onClick={() => setTfOpen((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] font-medium text-text hover:bg-surface"
          >
            {interval.toUpperCase()}
            <ChevronDownIcon size={12} className="text-text-muted" />
          </button>
          {tfOpen && (
            <div className="absolute left-0 top-8 z-20 w-20 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
              {chartIntervals.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => {
                    onIntervalChange(tf);
                    setTfOpen(false);
                  }}
                  className={`block w-full rounded-md px-2.5 py-1.5 text-left text-[12px] ${
                    tf === interval ? "bg-surface text-text" : "text-text-muted hover:bg-surface hover:text-text"
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          )}
        </div>

        <IconButton label="Candles" disabled title="Coming soon">
          <CandlesIcon />
        </IconButton>

        <IconButton label="Indicators" disabled title="Coming soon">
          <IndicatorsIcon size={14} />
        </IconButton>

        <div className="mx-1 h-4 w-px bg-border" />

        <button type="button" disabled title="Coming soon" className="cursor-not-allowed rounded-md px-2 py-1 text-[13px] font-semibold text-text-dim opacity-50">
          OL
        </button>
        <button type="button" disabled title="Coming soon" className="cursor-not-allowed rounded-md px-2 py-1 text-[13px] font-semibold text-text-dim opacity-50">
          TE
        </button>

        <div className="mx-1 h-4 w-px bg-border" />

        <IconButton label="Undo" disabled title="Coming soon">
          <UndoIcon />
        </IconButton>
        <IconButton label="Redo" disabled title="Coming soon">
          <RedoIcon />
        </IconButton>
        <IconButton label="Magnet" disabled title="Coming soon">
          <MagnetIcon />
        </IconButton>

        <div className="relative" ref={settingsRef}>
          <IconButton label="Settings" active={settingsOpen} onClick={() => setSettingsOpen((v) => !v)}>
            <GearIcon />
          </IconButton>
          {settingsOpen && (
            <div className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-border bg-panel-2 p-2 shadow-xl">
              <label className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-[12px] text-text-muted hover:bg-surface">
                <input type="checkbox" className="bp-checkbox" checked={showVolume} onChange={onToggleVolume} />
                Show volume
              </label>
            </div>
          )}
        </div>

        <IconButton label="Fullscreen" onClick={onFullscreen}>
          <ExpandIcon />
        </IconButton>
        <IconButton label="Screenshot" disabled title="Coming soon">
          <CameraIcon />
        </IconButton>

        <button
          type="button"
          onClick={onReset}
          className="ml-1 rounded-md px-2 py-1 text-[13px] font-medium text-text-muted hover:bg-surface hover:text-text"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
