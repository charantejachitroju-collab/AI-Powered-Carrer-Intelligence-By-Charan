export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let tokenProvider = async () => "";

export function setTokenProvider(provider) {
  tokenProvider = provider;
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const token = await tokenProvider();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
  let response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (response.status === 401) {
    const refreshedToken = await tokenProvider(true);
    if (refreshedToken && refreshedToken !== token) {
      headers.set("Authorization", `Bearer ${refreshedToken}`);
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    }
  }
  if (options.raw && response.ok) return response;
  const type = response.headers.get("content-type") || "";
  const data = type.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new ApiError(data?.error || data?.detail || `Request failed (${response.status}).`, response.status);
  }
  return data;
}

export const jsonRequest = (method, body) => ({
  method,
  body: JSON.stringify(body),
});
