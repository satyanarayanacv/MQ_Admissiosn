import Constants from "expo-constants";
import { Platform } from "react-native";

import { storage } from "@/src/utils/storage";

const BASE = `${Constants.expoConfig?.extra?.backendUrl || process.env.EXPO_PUBLIC_BACKEND_URL}/api`;
export const TOKEN_KEY = "admissions_access_token";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request(path: string, init: RequestInit = {}) {
  const token = await storage.secureGet(TOKEN_KEY, "");
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.detail || `Request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  get: (path: string) => request(path),
  post: (path: string, body?: unknown) => request(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  patch: (path: string, body?: unknown) => request(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  del: (path: string) => request(path, { method: "DELETE" }),
  loginForm: async (username: string, password: string) => {
    const body = new URLSearchParams({ username, password }).toString();
    const res = await fetch(`${BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data?.detail || "Login failed", res.status);
    return data;
  },
};

export async function fileUrl(applicationNo: string, document: string): Promise<string> {
  const token = await storage.secureGet(TOKEN_KEY, "");
  return `${BASE}/files/${encodeURIComponent(applicationNo)}/${encodeURIComponent(document)}?token=${token}`;
}

export async function uploadDocument(applicationNo: string, document: string, file: { uri: string; name: string; type: string }) {
  const token = await storage.secureGet(TOKEN_KEY, "");
  const form = new FormData();
  form.append("document", document);
  if (Platform.OS === "web") {
    const blob = await (await fetch(file.uri)).blob();
    form.append("file", blob, file.name);
  } else {
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as any);
  }
  const res = await fetch(`${BASE}/applicants/${encodeURIComponent(applicationNo)}/documents/upload`, {
    method: "POST",
    headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data?.detail || `Upload failed (${res.status})`, res.status);
  return data;
}
