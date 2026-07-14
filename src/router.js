const DEFAULT_ROUTE = "home";

export function getRoute() {
  const hash = window.location.hash.replace("#", "").trim();
  return hash || DEFAULT_ROUTE;
}

export function navigate(route) {
  window.location.hash = route;
}

export function onRouteChange(callback) {
  window.addEventListener("hashchange", () => callback(getRoute()));
}
