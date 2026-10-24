import { env } from "cloudflare:workers";
import { command, getRequestEvent, query } from "$app/server";
import { getAuthDb } from "../auth/config.server";
import { requirePermission, requireSameOrigin } from "../auth/guards.server";
import { getStaffAttendeeProgress } from "../checkpoints/checkpoints.remote";
import {
  previewRewardInput,
  redeemRewardInput,
  saveRewardGiftInput,
} from "./schemas";
import * as service from "./service.server";

export const listRewardGifts = query(async () => {
  const actor = requirePermission(
    getRequestEvent().locals.user,
    "activityStaff",
  );
  return service.listRewardGifts(getAuthDb(env), actor.id);
});

export const previewReward = query(previewRewardInput, async (input) => {
  const actor = requirePermission(
    getRequestEvent().locals.user,
    "activityStaff",
  );
  return service.previewReward(getAuthDb(env), actor.id, input);
});

export const saveRewardGift = command(saveRewardGiftInput, async (input) => {
  const event = getRequestEvent();
  requireSameOrigin(event);
  const actor = requirePermission(event.locals.user, "admin");
  const result = await service.saveRewardGift(getAuthDb(env), actor.id, input);
  await listRewardGifts().refresh();
  return result;
});

export const redeemReward = command(redeemRewardInput, async (input) => {
  const event = getRequestEvent();
  requireSameOrigin(event);
  const actor = requirePermission(event.locals.user, "activityStaff");
  const result = await service.redeemReward(getAuthDb(env), actor.id, input);
  await Promise.all([
    previewReward({ qrCodeId: input.qrCodeId }).refresh(),
    getStaffAttendeeProgress({ qrCodeId: input.qrCodeId }).refresh(),
  ]);
  return result;
});
