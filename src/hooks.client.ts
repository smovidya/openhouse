import type { ClientInit } from "@sveltejs/kit/hooks";

export const init: ClientInit = () => {
  if (!/\bLine\//i.test(navigator.userAgent)) return;

  const url = new URL(window.location.href);
  if (url.searchParams.get("openExternalBrowser") === "1") return;

  url.searchParams.set("openExternalBrowser", "1");
  window.location.replace(url.href);
};
