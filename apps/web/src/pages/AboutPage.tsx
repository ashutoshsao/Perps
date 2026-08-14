import { useEffect } from "react";
import { Link } from "react-router-dom";
import { LandingHeader } from "../components/landing/LandingHeader";
import { LandingFooter } from "../components/landing/LandingFooter";
import { CornerMarks } from "../components/landing/CornerMarks";

const sections = [
  {
    n: "01",
    title: "What is Nebula, actually?",
    body: [
      "Say you think the price of Bitcoin is going to go up. Normally, to make money from that, you'd have to buy actual Bitcoin and wait.",
      "Nebula lets you make a bet on the price going up or down — without ever owning any Bitcoin. If you're right, you make money. If you're wrong, you lose money. That's the whole idea.",
    ],
  },
  {
    n: "02",
    title: "Why \"perpetual\"?",
    body: [
      "A normal bet like this — called a \"future\" — has an expiry date, like a coupon. Nebula's bets don't expire. You can hold your position for a day or a year, as long as you want.",
      "To keep the bet's price honest and close to the real price of Bitcoin, people holding the bet pay a small fee back and forth between each other every so often. That's called \"funding,\" and it happens automatically.",
    ],
  },
  {
    n: "03",
    title: "What's leverage, and why is it dangerous?",
    body: [
      "Leverage lets you make a bet bigger than the money you actually put in — like putting down $100 to control a $1,000 bet.",
      "That sounds great when you're right: a small price move turns into a much bigger gain. But it works exactly the same in reverse. A small move against you can wipe out your $100 fast — sometimes in minutes. The bigger the leverage, the smaller the price move it takes to lose everything you put in.",
      "This is the single most important thing to understand before trading here: leverage amplifies losses just as fast as it amplifies gains, and it can lose you money quickly. Never trade money you can't afford to lose.",
    ],
  },
  {
    n: "04",
    title: "How does a trade actually happen?",
    body: [
      "Nebula keeps a running list of everyone who wants to buy and everyone who wants to sell, each at the price they want — that's called the order book.",
      "When someone's buying price matches someone's selling price, the two get matched automatically and the trade happens, instantly and in order. No one behind the scenes decides who gets matched — the order book does, based on price and who asked first.",
    ],
  },
];

export function AboutPage() {
  useEffect(() => {
    document.title = "About — Nebula";
  }, []);

  return (
    <div className="bg-grain min-h-screen bg-bg text-text">
      <LandingHeader />

      <main className="mx-auto w-full max-w-[720px] px-6 py-16 md:py-24">
        <span className="rounded-full border border-border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.06em] text-text-dim">
          ABOUT NEBULA
        </span>
        <h1 className="mt-4 font-mono text-[34px] font-bold leading-tight text-text" style={{ textWrap: "balance" }}>
          Nebula, explained without the jargon
        </h1>
        <p className="mt-4 max-w-[52ch] text-[16px] leading-relaxed text-text-muted">
          No finance background needed. No computer science background needed. Just a plain explanation of what this
          is and what it isn't.
        </p>

        <div className="mt-16 flex flex-col gap-14">
          {sections.map((s) => (
            <section key={s.n}>
              <div className="flex items-baseline gap-4">
                <span className="font-mono text-[13px] font-semibold text-text-dim">{s.n}</span>
                <h2 className="text-[22px] font-semibold text-text">{s.title}</h2>
              </div>
              <div className="mt-4 flex flex-col gap-3 pl-9">
                {s.body.map((p, i) => (
                  <p key={i} className="max-w-[56ch] text-[15px] leading-relaxed text-text-muted">
                    {p}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="relative mt-16 rounded-xl border border-red/30 bg-red-dim px-6 py-5">
          <CornerMarks color="border-red/40" />
          <h3 className="text-[14px] font-semibold text-red">This is real money, real risk</h3>
          <p className="mt-2 max-w-[56ch] text-[14px] leading-relaxed text-text-muted">
            Leverage trading can lose you money fast, especially at high leverage. Nebula does not promise profit —
            nothing here does. Only trade money you can genuinely afford to lose.
          </p>
        </div>

        <div className="mt-16 flex items-center gap-4">
          <Link
            to="/trade"
            className="rounded-full bg-text px-6 py-3 text-[14px] font-semibold text-bg hover:bg-text/90"
          >
            Start trading
          </Link>
          <Link to="/" className="text-[14px] font-medium text-text-muted hover:text-text">
            Back to home
          </Link>
        </div>
      </main>

      <LandingFooter />
    </div>
  );
}
