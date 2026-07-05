import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
export const API = `${BASE}/api`;
const inFlightGets = new Map<string, Promise<any>>();

const TOKEN_KEY = "pawfind_session_token";

export async function getToken(): Promise<string | null> {
  return await storage.secureGet<string>(TOKEN_KEY, "");
}
export async function setToken(token: string) {
  await storage.secureSet(TOKEN_KEY, token);
}
export async function clearToken() {
  await storage.secureRemove(TOKEN_KEY);
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiGet(path: string, auth = false) {
  const headers = auth ? await authHeaders() : {};
  const url = `${API}${path}`;
  const authToken = headers.Authorization || "";
  const requestKey = `${auth ? "auth" : "anon"}:${url}:${authToken}`;
  const existing = inFlightGets.get(requestKey);
  if (existing) return existing;

  const request = (async () => {
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
  })();

  inFlightGets.set(requestKey, request);
  try {
    return await request;
  } finally {
    inFlightGets.delete(requestKey);
  }
}

export async function apiPost(path: string, body: any, auth = false) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, await authHeaders());
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json();
}

export function photoUrl(
  shop: { image_url?: string | null; photo_name?: string | null },
  opts: { size?: "preview" | "full"; maxWidth?: number } = {},
): string | null {
  if (shop.image_url) return shop.image_url;
  if (shop.photo_name?.startsWith("http://") || shop.photo_name?.startsWith("https://")) return shop.photo_name;
  if (shop.photo_name) {
    const maxWidth = opts.maxWidth ?? (opts.size === "preview" ? 400 : 800);
    return `${API}/places/photo?name=${encodeURIComponent(shop.photo_name)}&max_width=${maxWidth}`;
  }
  return null;
}
