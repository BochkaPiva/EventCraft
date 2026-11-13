import { HttpError } from "./http.ts";

export function parseServerConfiguration(values: {
  url?: string;
  key?: string;
  origin?: string;
}) {
  const { url, key, origin } = values;
  if (!url || !key || !origin)
    throw new HttpError(503, "workspace_not_configured");
  try {
    const endpoint = new URL(url);
    const application = new URL(origin);
    const permitted = (value: URL) =>
      (value.protocol === "https:" ||
        (value.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(value.hostname))) &&
      !value.username &&
      !value.password &&
      !value.search &&
      !value.hash;
    if (
      !permitted(endpoint) ||
      !permitted(application) ||
      endpoint.pathname !== "/" ||
      application.origin !== origin ||
      !key.startsWith("sb_publishable_")
    )
      throw Error("Invalid server configuration");
  } catch {
    throw new HttpError(503, "workspace_not_configured");
  }
  return { url, key, origin };
}
