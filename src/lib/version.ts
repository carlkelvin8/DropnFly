export const APP_BUILD = (process.env.NEXT_PUBLIC_APP_BUILD || "local").trim();

export const APP_BUILD_SHORT =
  APP_BUILD === "local" ? "local-dev" : APP_BUILD.length > 7 ? APP_BUILD.slice(0, 7) : APP_BUILD;