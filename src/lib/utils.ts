export { cn } from "cn";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChild<T> = T extends { child?: any } ? Omit<T, "child"> : T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WithoutChildren<T> = T extends { children?: any }
  ? Omit<T, "children">
  : T;
export type WithoutChildrenOrChild<T> = WithoutChildren<WithoutChild<T>>;
export type WithElementRef<T, U extends HTMLElement = HTMLElement> = T & {
  ref?: U | null;
};

/** A thrown remote-function error's HTTP status, if any. */
export function httpStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error))
    return null;
  return typeof error.status === "number" ? error.status : null;
}
