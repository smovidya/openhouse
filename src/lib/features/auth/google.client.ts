// The subset of Google Identity Services used by the main page.
export interface GoogleIdentity {
  initialize(options: {
    client_id: string;
    ux_mode: "popup";
    nonce: string;
    auto_select: boolean;
    button_auto_select: boolean;
    callback: (response: { credential: string }) => void;
  }): void;
  renderButton(
    element: HTMLElement,
    options: {
      type: "standard";
      theme: "outline";
      size: "large";
      text: "continue_with";
    },
  ): void;
  disableAutoSelect(): void;
}

function currentIdentity() {
  return (
    window as Window & {
      google?: { accounts?: { id?: GoogleIdentity } };
    }
  ).google?.accounts?.id;
}

let loading: Promise<GoogleIdentity> | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  const existing = currentIdentity();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;

  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    const finish = (failure?: string) => {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      const identity = currentIdentity();
      if (!failure && identity) resolve(identity);
      else {
        script.remove();
        reject(
          new Error(
            failure ?? "Google sign-in could not initialize. Please try again.",
          ),
        );
      }
    };
    const timeout = setTimeout(
      () =>
        finish(
          "Google sign-in timed out. Check your connection and try again.",
        ),
      15_000,
    );
    script.onload = () => finish();
    script.onerror = () =>
      finish(
        "Google sign-in could not load. Check your connection or content blocker and try again.",
      );
    document.head.appendChild(script);
  }).catch((error) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function disableGoogleAutoSelect() {
  currentIdentity()?.disableAutoSelect();
}
