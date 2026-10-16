import { refreshAll } from "$app/navigation";
import {
  signInWithGoogle as signInWithGoogleRemote,
  logout as logoutRemote,
} from "./auth.remote";
import { createDevSession as createDevSessionRemote } from "./dev.remote";

export { beginGoogleSignIn } from "./auth.remote";

// UI event handlers should use these helpers so layout data and active queries
// are refreshed after the server has updated the session cookie.
export async function signInWithGoogle(
  input: Parameters<typeof signInWithGoogleRemote>[0],
) {
  const session = await signInWithGoogleRemote(input);
  await refreshAll();
  return session;
}

export async function createDevSession(
  input: Parameters<typeof createDevSessionRemote>[0],
) {
  const session = await createDevSessionRemote(input);
  await refreshAll();
  return session;
}

export async function logout() {
  const result = await logoutRemote();
  await refreshAll();
  return result;
}
