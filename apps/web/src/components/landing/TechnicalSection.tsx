import { motion, useReducedMotion } from "framer-motion";
import { technicalPoints } from "../../data/landingContent";
import { CornerMarks } from "./CornerMarks";

export function TechnicalSection() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="mx-auto w-full max-w-[1100px] px-6 py-20">
      <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-text-dim">
        HOW THE ENGINE ACTUALLY WORKS
      </span>
      <h2
        className="mt-4 max-w-[32ch] font-mono text-[28px] font-bold leading-tight text-text"
        style={{ textWrap: "balance" }}
      >
        Built like exchange infrastructure, not a demo.
      </h2>

      <div className="relative mt-12 grid grid-cols-1 gap-8 rounded-2xl border border-border-soft p-8 md:grid-cols-2 md:p-10">
        <CornerMarks />
        {technicalPoints.map((point, i) => (
          <motion.div
            key={point.title}
            initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
            whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.4, ease: "easeOut", delay: i * 0.05 }}
            className="flex gap-4 border-t border-border-soft pt-5"
          >
            <span className="font-mono text-[22px] font-bold text-blue">{point.stat}</span>
            <div>
              <h3 className="text-[15px] font-semibold text-text">{point.title}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-text-muted">{point.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
