import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { hero } from "../../data/landingContent";
import { CornerMarks } from "./CornerMarks";
import { SketchArrow } from "./SketchArrow";
import { OrderbookPreview } from "./orderbookPreview";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export function Hero() {
  return (
    <section className="mx-auto w-full max-w-[1100px] px-6 py-16 md:py-24">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative grid grid-cols-1 items-center gap-10 overflow-hidden rounded-2xl border border-border-soft bg-panel/40 p-8 md:grid-cols-2 md:p-14"
      >
        <CornerMarks />
        {/* dog-ear fold, top-right */}
        <div
          className="absolute right-0 top-0 h-7 w-7 bg-blue"
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        />

        <div className="flex flex-col items-start">
          <motion.span
            variants={item}
            className="rounded-full border border-border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-blue"
          >
            {hero.eyebrow}
          </motion.span>

          <motion.h1
            variants={item}
            className="mt-6 max-w-[14ch] font-mono text-[42px] font-bold leading-[1.08] text-text md:text-[52px]"
            style={{ textWrap: "balance" }}
          >
            {hero.headline}
          </motion.h1>

          <motion.p variants={item} className="mt-6 max-w-[48ch] text-[17px] leading-relaxed text-text-muted">
            {hero.subhead}
          </motion.p>

          <motion.div variants={item} className="relative mt-16 flex items-center gap-4">
            <SketchArrow className="absolute -top-14 left-20" />
            <Link
              to={hero.primaryCta.to}
              className="rounded-full bg-text px-6 py-3 text-[14px] font-semibold text-bg hover:bg-text/90"
            >
              {hero.primaryCta.label}
            </Link>
            <Link
              to={hero.secondaryCta.to}
              className="rounded-full border border-border px-6 py-3 text-[14px] font-semibold text-text hover:bg-surface"
            >
              {hero.secondaryCta.label}
            </Link>
          </motion.div>
        </div>

        <motion.div variants={item} className="flex items-center justify-center">
          <OrderbookPreview />
        </motion.div>
      </motion.div>
    </section>
  );
}
