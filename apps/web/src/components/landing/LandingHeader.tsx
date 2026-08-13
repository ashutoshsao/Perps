import { Link } from "react-router-dom";
import { NebulaLogo, MoonIcon, SunIcon } from "../../icons";
import { landingNavLinks } from "../../data/landingContent";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../hooks/useTheme";

export function LandingHeader() {
  const { token, username, openAuthModal, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-4 px-4 py-6 sm:px-6">
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <NebulaLogo size={24} />
        <span className="text-[16px] font-bold text-text">Nebula</span>
      </Link>

      <nav className="hidden items-center gap-6 sm:flex">
        {landingNavLinks.map((link) => (
          <Link key={link.to} to={link.to} className="text-[14px] font-medium text-text-muted hover:text-text">
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2 sm:gap-4">
        <button type="button" onClick={toggleTheme} className="shrink-0 text-text-muted hover:text-text">
          {theme === "dark" ? <SunIcon size={17} /> : <MoonIcon size={17} />}
        </button>

        {token ? (
          <button
            type="button"
            onClick={logout}
            className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-text hover:bg-surface sm:px-4"
          >
            Log out {username ? `(${username})` : ""}
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={() => openAuthModal("login")}
              className="whitespace-nowrap rounded-full border border-border px-3 py-1.5 text-[13px] font-semibold text-text hover:bg-surface sm:px-4"
            >
              Log in
            </button>
            <button
              type="button"
              onClick={() => openAuthModal("signup")}
              className="whitespace-nowrap rounded-full bg-text px-3 py-1.5 text-[13px] font-semibold text-bg hover:bg-text/90 sm:px-4"
            >
              Sign up
            </button>
          </>
        )}
      </div>
    </header>
  );
}
