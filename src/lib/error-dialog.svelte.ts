// One app-wide error dialog, rendered by <ErrorDialogHost /> in the root layout.
// Only open it from client-side handlers: this state is shared by the whole module.

export type ErrorMessage = Readonly<{ title: string; description: string }>;

// Raw: close() compares identity, which a deep $state proxy would break.
let current = $state.raw<
  (ErrorMessage & { readonly close: () => void }) | null
>(null);

/** The open error, if any (read by ErrorDialogHost). */
export const errorDialog = {
  get current() {
    return current;
  },
};

/**
 * Shows an error dialog; resolves once it's dismissed. A new error replaces an open one (which
 * resolves then). Await it in a QR scanner's onScan to keep the camera frozen meanwhile.
 */
export function showError(message: ErrorMessage) {
  current?.close();
  return new Promise<void>((resolve) => {
    const open = {
      ...message,
      close: () => {
        if (current === open) current = null;
        resolve();
      },
    };
    current = open;
  });
}
