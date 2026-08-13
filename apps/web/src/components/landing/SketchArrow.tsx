import { motion } from "framer-motion";

// Dashed hand-drawn-style arrow pointing at the primary CTA
export function SketchArrow({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`pointer-events-none ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, x: [0, -5, 0], y: [0, 4, 0] }}
      transition={{
        opacity: { duration: 0.4, delay: 1 },
        x: { duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1.4 },
        y: { duration: 1.6, repeat: Infinity, repeatType: "mirror", ease: "easeInOut", delay: 1.4 },
      }}
    >
      <svg viewBox="0 0 130 70" className="w-28 text-blue">
        <motion.path
          d="M120,10 C95,6 60,13 40,33 C28,46 25,48 18,52"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray="7 7"
          animate={{ strokeDashoffset: [0, -28] }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <path d="M15,54 L22,42 L28,53 Z" fill="currentColor" transform="rotate(-10 30 60)" />
      </svg>
    </motion.div>
  );
}
