import { BLUR_DOWNSCALE, createBlur } from "./shaders/blur.js";
import { createLiquidGlass, type GlassDraw } from "./shaders/liquid-glass.js";
import {
  createWaterCaustic,
  type WaterCausticParams,
} from "./shaders/water-caustic.js";
import type { FramePlan } from "./frame-plan.js";

// Shader params from the Figma fill; `playhead` comes from the plan.
const CAUSTICS: Omit<WaterCausticParams, "playhead"> = {
  center: { x: 50, y: 50 },
  scale: 1,
  intensity: 0.5,
  waterColor: { r: 0, g: 0.388, b: 0.706, a: 1 },
  highlightColor: { r: 0.804, g: 0.961, b: 1, a: 1 },
};

const WATER_FORMAT: GPUTextureFormat = "rgba8unorm";
/** Each level downsamples 4x per axis; the result is reconstructed to 1/4 of the water. */
const BLUR_LEVELS = 2;

/**
 * GPU side of the water background: pipelines and render targets, created once per device.
 *   water   — caustics, WATER_RESOLUTION of the viewport
 *   blurred — the water, frosted, 1/BLUR_DOWNSCALE of that (what <Glass> panes see)
 * The page canvas (null with the static background) shows the tinted water; each pane draws into
 * its own canvas. Without water (rim-only glass on the static background), 1×1 placeholders are
 * bound instead.
 */
export function createRenderer(
  device: GPUDevice,
  page: GPUCanvasContext | null,
  format: GPUTextureFormat,
) {
  const caustics = createWaterCaustic(device, WATER_FORMAT);
  const blur = createBlur(device, WATER_FORMAT, BLUR_LEVELS);
  const glass = createLiquidGlass(device, format);

  let water: GPUTexture | undefined;
  let blurred: GPUTexture | undefined;

  function ensureTargets(size: FramePlan["water"]) {
    const { width, height } = size ?? { width: 1, height: 1 };
    if (water?.width === width && water.height === height) return;
    water?.destroy();
    blurred?.destroy();
    const usage =
      GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING;
    water = device.createTexture({
      label: "water",
      size: [width, height],
      format: WATER_FORMAT,
      usage,
    });
    blurred = device.createTexture({
      label: "water blurred",
      size: [
        Math.ceil(width / BLUR_DOWNSCALE),
        Math.ceil(height / BLUR_DOWNSCALE),
      ],
      format: WATER_FORMAT,
      usage,
    });
    glass.bind(water, blurred);
  }

  return {
    execute(plan: FramePlan) {
      const { inputs } = plan;
      ensureTargets(plan.water);
      const encoder = device.createCommandEncoder({ label: "frame" });

      if (plan.caustics)
        caustics(encoder, water!, { ...CAUSTICS, ...plan.caustics });
      if (plan.blur) blur.encode(encoder, water!, blurred!, plan.blur.sigma);

      const draws: GlassDraw[] = [];
      if (plan.background && page) {
        draws.push({
          kind: "background",
          target: page.getCurrentTexture(),
          dpr: inputs.dpr,
          tint: inputs.tint,
        });
      }
      for (const pane of plan.panes) {
        draws.push({
          kind: inputs.glass === "full" ? "pane" : "rim",
          target: pane.context.getCurrentTexture(),
          viewport: { width: inputs.width, height: inputs.height },
          pane: { ...pane.rect, radius: pane.radius, variant: pane.variant },
          dpr: inputs.dpr,
          tint: inputs.tint,
          options: pane.options,
        });
      }
      glass.encode(encoder, draws);

      device.queue.submit([encoder.finish()]);
    },

    destroy() {
      water?.destroy();
      blurred?.destroy();
      blur.destroy();
      glass.destroy();
    },
  };
}
