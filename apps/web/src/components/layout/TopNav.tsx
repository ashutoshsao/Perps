import { useEffect, useRef, useState } from "react";
import { BackpackLogo, ChevronDownIcon, MoonIcon, SearchIcon, SunIcon } from "../../icons";
import { navLinks } from "../../data/mockMarket";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { DepositModal } from "../account/DepositModal";

const ACTIVE_NAV_LINK = "Futures";

const moreLinks = ["Referrals", "Rewards", "API Docs", "Help Center"];

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function TopNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    (localStorage.getItem("bp_theme") as "dark" | "light") ?? "dark",
  );

  const { token, username, openAuthModal, logout } = useAuth();
  const { push } = useToast();

  const moreRef = useClickOutside(() => setMoreOpen(false));
  const accountRef = useClickOutside(() => setAccountOpen(false));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bp_theme", theme);
  }, [theme]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border-soft bg-panel px-6">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2">
          <BackpackLogo size={26} />
          <span className="text-[17px] font-bold text-text">Backpack</span>
        </div>

        <nav className="flex items-center gap-7">
          {navLinks.map((link) =>
            link === ACTIVE_NAV_LINK ? (
              <span key={link} className="text-[14px] font-semibold text-text">
                {link}
              </span>
            ) : (
              <button
                key={link}
                type="button"
                disabled
                title="Coming soon"
                className="cursor-not-allowed text-[14px] font-medium text-text-dim opacity-50"
              >
                {link}
              </button>
            ),
          )}
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-1 text-[14px] font-medium text-text-muted hover:text-text"
            >
              More
              <ChevronDownIcon size={13} className={moreOpen ? "rotate-180 transition-transform" : "transition-transform"} />
            </button>
            {moreOpen && (
              <div className="absolute left-0 top-8 z-20 w-44 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
                {moreLinks.map((l) => (
                  <button
                    key={l}
                    type="button"
                    disabled
                    title="Coming soon"
                    className="block w-full cursor-not-allowed rounded-md px-3 py-2 text-left text-[13px] text-text-dim opacity-50"
                  >
                    {l}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" disabled title="Market search coming soon" className="cursor-not-allowed text-text-dim opacity-50">
          <SearchIcon size={17} />
        </button>

        <button
          type="button"
          onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
          className="text-text-muted hover:text-text"
        >
          {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
        </button>

        {token ? (
          <div className="relative" ref={accountRef}>
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-text hover:bg-surface"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue text-[10px] font-bold text-white">
                {(username ?? "?")[0]?.toUpperCase()}
              </span>
              {username ?? "Account"}
              <ChevronDownIcon size={12} />
            </button>
            {accountOpen && (
              <div className="absolute right-0 top-10 z-20 w-48 rounded-lg border border-border bg-panel-2 p-1 shadow-xl">
                <div className="truncate px-3 py-2 text-[12px] text-text-dim">{username}</div>
                <button
                  type="button"
                  onClick={() => {
                    setAccountOpen(false);
                    setDepositOpen(true);
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-[13px] text-text hover:bg-surface"
                >
                  Deposit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setAccountOpen(false);
                    push("Logged out");
                  }}
                  className="block w-full rounded-md px-3 py-2 text-left text-[13px] text-red hover:bg-surface"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="rounded-full border border-border px-4 py-1.5 text-[13px] font-semibold text-text hover:bg-surface"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="rounded-full bg-text px-4 py-1.5 text-[13px] font-semibold text-bg hover:bg-text/90"
            >
              Sign up
            </button>
          </>
        )}
      </div>

      {depositOpen && <DepositModal onClose={() => setDepositOpen(false)} />}
    </header>
  );
}
