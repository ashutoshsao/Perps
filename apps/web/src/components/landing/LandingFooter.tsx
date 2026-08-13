import { Link } from "react-router-dom";
import { NebulaLogo } from "../../icons";
import { landingNavLinks } from "../../data/landingContent";

export function LandingFooter() {
  return (
    <footer className="mx-auto flex w-full max-w-[1100px] flex-col items-center gap-4 border-t border-border-soft px-6 py-8 sm:flex-row sm:justify-between">
      <div className="flex items-center gap-2">
        <NebulaLogo size={18} />
        <span className="text-[13px] font-medium text-text-muted">Nebula</span>
      </div>

      <nav className="flex items-center gap-6">
        {landingNavLinks.map((link) => (
          <Link key={link.to} to={link.to} className="text-[13px] text-text-muted hover:text-text">
            {link.label}
          </Link>
        ))}
      </nav>

      <span className="text-center text-[12px] text-text-dim">Leverage can lose money fast — trade carefully.</span>
    </footer>
  );
}
