import { useEffect, useState } from "react";
import type { Route } from "./app/types";
import { AUTH_TOKEN_KEY } from "./app/constants";
import { getRouteFromLocation, getStoredToken, navigate } from "./app/navigation";
import { AdminScreen } from "./screens/AdminScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { ExchangeShell } from "./screens/ExchangeShell";
import { WalletScreen } from "./screens/WalletScreen";

export function App() {
  const [route, setRoute] = useState<Route>(getRouteFromLocation);
  const [token, setToken] = useState<string | null>(getStoredToken);

  useEffect(() => {
    if (window.location.hash.startsWith("#/")) {
      const initialRoute = getRouteFromLocation();
      window.history.replaceState(null, "", initialRoute === "trade" ? "/" : "/" + initialRoute);
    }

    const onLocationChange = () => setRoute(getRouteFromLocation());
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  function handleAuth(tokenValue: string) {
    window.localStorage.setItem(AUTH_TOKEN_KEY, tokenValue);
    setToken(tokenValue);
    navigate("trade");
  }

  function handleSignOut() {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    setToken(null);
    navigate("signin");
  }

  if (route === "signin") return <AuthScreen mode="signin" onAuth={handleAuth} />;
  if (route === "signup") return <AuthScreen mode="signup" onAuth={handleAuth} />;
  if (route === "wallet") return <WalletScreen token={token} onSignOut={handleSignOut} />;
  if (route === "admin") return <AdminScreen token={token} onSignOut={handleSignOut} />;
  return <ExchangeShell token={token} onSignOut={handleSignOut} />;
}
