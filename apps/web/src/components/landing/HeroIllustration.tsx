import { motion } from "framer-motion";

// A stylized depth chart — the same "valley" shape a real order book depth
// chart draws (cumulative volume low near mid-price, rising toward the edges),
// stepped like the staircase a real order book produces. Grounded in the actual
// product rather than a generic hero graphic.
const BID_TOP =
  "M0,70 H40 V110 H80 V140 H120 V175 H160 V205 H200 V230 H240 V320 H0 Z";
const ASK_TOP =
  "M240,230 H280 V205 H320 V175 H360 V140 H400 V110 H440 V70 H480 V320 H240 Z";

export function HeroIllustration() {
  return (
    <motion.svg
      viewBox="0 0 480 320"
      className="w-full max-w-[480px]"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <line
          key={i}
          x1={0}
          x2={480}
          y1={40 + i * 50}
          y2={40 + i * 50}
          stroke="var(--color-border-soft)"
          strokeWidth={1}
        />
      ))}

      <path d={BID_TOP} fill="var(--color-green-dim)" stroke="var(--color-green)" strokeWidth={1.5} />
      <path d={ASK_TOP} fill="var(--color-red-dim)" stroke="var(--color-red)" strokeWidth={1.5} />

      <line x1={240} y1={20} x2={240} y2={320} stroke="var(--color-blue)" strokeWidth={1.5} strokeDasharray="4 4" />
      <circle cx={240} cy={230} r={3.5} fill="var(--color-blue)" />

      <text x={240} y={16} textAnchor="middle" fontFamily="var(--font-mono)" fontSize={11} fill="var(--color-blue)">
        MID
      </text>
    </motion.svg>
  );
}
