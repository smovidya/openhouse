import type { Cookies } from "@sveltejs/kit";
import { getTimeGateSnapshot } from "#lib/constants/time.ts";

export const MOCK_NOW_COOKIE = "openhouse-mock-now";

const mockCookieOptions = {
  path: "/",
  httpOnly: true,
  sameSite: "strict",
  secure: false,
  maxAge: 60 * 60 * 24 * 7,
} as const;

export function getRequestTimeGates(cookies: Cookies, development: boolean) {
  const encoded = development ? cookies.get(MOCK_NOW_COOKIE) : undefined;
  const mockNow = encoded ? new Date(encoded) : null;
  const hasValidMock = mockNow !== null && !Number.isNaN(mockNow.getTime());
  return getTimeGateSnapshot(hasValidMock ? mockNow : new Date(), hasValidMock);
}

export function setMockNow(cookies: Cookies, now: Date) {
  cookies.set(MOCK_NOW_COOKIE, now.toISOString(), mockCookieOptions);
  return getTimeGateSnapshot(now, true);
}

export function clearMockNow(cookies: Cookies) {
  cookies.delete(MOCK_NOW_COOKIE, { path: "/" });
  return getTimeGateSnapshot(new Date(), false);
}
