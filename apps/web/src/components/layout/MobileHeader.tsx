import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon, MoonIcon, NebulaLogo, SearchIcon, SunIcon } from "../../icons";
import { navLinks } from "../../data/mockMarket";
import { useAuth } from "../../context/AuthContext";

const ACTIVE_NAV_LINK = "Futures";
const moreLinks = ["Referrals", "Rewards", "API Docs", "Help Center"];

export function MobileHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    (localStorage.getItem("bp_theme") as "dark" | "light") ?? "dark",
  );

  const { token, username, openAuthModal, logout } = useAuth();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("bp_theme", theme);
  }, [theme]);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-soft bg-panel px-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setDrawerOpen(true)} className="text-text-muted hover:text-text" aria-label="Open menu">
          <MenuIcon size={20} />
        </button>
        <NebulaLogo size={24} />
        <span className="text-[16px] font-bold text-text">Nebula</span>
      </div>

      <div className="flex items-center gap-3">
        <button type="button" disabled title="Market search coming soon" className="cursor-not-allowed text-text-dim opacity-50">
          <SearchIcon size={16} />
        </button>
        <button type="button" onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))} className="text-text-muted hover:text-text">
          {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
        {!token && (
          <>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="rounded-full border border-border px-3 py-1.5 text-[12px] font-semibold text-text hover:bg-surface"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="rounded-full bg-text px-3 py-1.5 text-[12px] font-semibold text-bg hover:bg-text/90"
            >
              Sign up
            </button>
          </>
        )}
      </div>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} />
          <div className="relative flex h-full w-72 flex-col gap-1 overflow-y-auto border-r border-border-soft bg-panel-2 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <NebulaLogo size={22} />
                <span className="text-[15px] font-bold text-text">Nebula</span>
              </span>
              <button type="button" onClick={() => setDrawerOpen(false)} className="text-text-muted hover:text-text" aria-label="Close menu">
                <CloseIcon size={18} />
              </button>
            </div>

            {token && (
              <div className="mb-2 flex items-center gap-2 rounded-lg bg-surface px-3 py-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue text-[12px] font-bold text-white">
                  {(username ?? "?")[0]?.toUpperCase()}
                </span>
                <span className="truncate text-[13px] font-semibold text-text">{username}</span>
              </div>
            )}

            {navLinks.map((link) =>
              link === ACTIVE_NAV_LINK ? (
                <span key={link} className="rounded-md bg-surface px-3 py-2.5 text-[14px] font-semibold text-text">
                  {link}
                </span>
              ) : (
                <button
                  key={link}
                  type="button"
                  disabled
                  title="Coming soon"
                  className="cursor-not-allowed rounded-md px-3 py-2.5 text-left text-[14px] font-medium text-text-dim opacity-50"
                >
                  {link}
                </button>
              ),
            )}

            <div className="my-2 border-t border-border-soft" />

            {moreLinks.map((l) => (
              <button
                key={l}
                type="button"
                disabled
                title="Coming soon"
                className="cursor-not-allowed rounded-md px-3 py-2.5 text-left text-[13px] text-text-dim opacity-50"
              >
                {l}
              </button>
            ))}

            {token && (
              <>
                <div className="my-2 border-t border-border-soft" />
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    setDrawerOpen(false);
                  }}
                  className="rounded-md px-3 py-2.5 text-left text-[13px] font-medium text-red hover:bg-surface"
                >
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
