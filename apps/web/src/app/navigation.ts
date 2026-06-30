import { AUTH_TOKEN_KEY } from "./constants";
import type { Route } from "./types";

export function getRouteFromLocation(): Route {
  const hashRoute = window.location.hash.replace("#/", "");
  const route = hashRoute || window.location.pathname.replace(/^\//, "");
  if (route === "wallet") return route;
  if (route === "admin") return route;
  if (route === "signin" || route === "signup") return route;
  return "trade";
}

export function navigate(route: Route) {
  const path = route === "trade" ? "/" : `/${route}`;
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function getStoredToken() {
  return window.localStorage.getItem(AUTH_TOKEN_KEY);
}
