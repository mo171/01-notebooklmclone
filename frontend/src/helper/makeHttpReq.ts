import { apiUrl } from "@/config/get-env"
import { debugLog } from "./debugLog"

export type HttpVerbType = 'GET' | 'POST' | 'PUT' | 'DELETE'

function getErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const msg = (data as { message?: unknown }).message
    if (typeof msg === "string") return msg
  }
  return "Request failed"
}

export async function makeHttpReq<T>(verb: HttpVerbType, endpoint: string, input?: T) {
  debugLog("HTTP", `→ ${verb} ${endpoint}`, input)

  try {
    const accessToken = localStorage.getItem("accessToken");
    const headers: Record<string, string> = {
      accept: "application/json",
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${apiUrl}/api/v1/${endpoint}`, {
      method: verb,
      credentials: "include",
      headers,
      body: input ? JSON.stringify(input) : undefined,
    });

    const data = await res.json();

    if (!res.ok) {
      debugLog("HTTP", `← ${verb} ${endpoint} FAILED ${res.status}`, data)
      return Promise.reject(data);
    }

    debugLog("HTTP", `← ${verb} ${endpoint} OK ${res.status}`, data)
    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Network error"
    debugLog("HTTP", `← ${verb} ${endpoint} ERROR`, { message })
    return Promise.reject({
      message,
    });
  }
}

export { getErrorMessage }
