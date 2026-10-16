import { refreshAll } from "$app/navigation";
import {
  enrollStaff as enrollRemote,
  redeemInviteCode as redeemRemote,
} from "./staff.remote";

export async function enrollStaff(input: Parameters<typeof enrollRemote>[0]) {
  const session = await enrollRemote(input);
  await refreshAll();
  return session;
}

export async function redeemInviteCode(
  input: Parameters<typeof redeemRemote>[0],
) {
  const session = await redeemRemote(input);
  await refreshAll();
  return session;
}
