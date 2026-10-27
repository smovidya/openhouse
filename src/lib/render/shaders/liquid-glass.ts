import shaderCode from "./liquid-glass.wgsl?raw";

export type GlassVariant = "dark" | "light";

/** Surface fill drawn over the refracted backdrop, [r, g, b, alpha]. */
const SURFACE: Record<GlassVariant, [number, number, number, number]> = {
  dark: [0, 0, 0, 0.3], // Figma card-black
  light: [1, 1, 1, 0.15],
};

export type Rgba = [number, number, number, number];

/** Per-pane look. Lengths are CSS px. */
export type GlassOptions = {
  /** Width of the rim band that bends light. */
  refractionHeight: number;
  /** Sample shift at the very edge. */
  refractionAmount: number;
  /** 0–1: also bend away from the pane centre, not just the edge normal. */
  depth: number;
  /** 0–1: chromatic aberration (strongest on the diagonals). */
  dispersion: number;
  /** Backdrop saturation (1 = unchanged). */
  vibrancy: number;
  /** Rim highlight stroke width, inside the edge. */
  highlightWidth: number;
  /** Rim highlight strength (white, added). */
  highlightAlpha: number;
  /** Degrees; lights the edges facing this way and the opposite way. */
  highlightAngle: number;
};

export const DEFAULT_GLASS_OPTIONS: GlassOptions = {
  refractionHeight: 24,
  refractionAmount: 112,
  depth: 1,
  dispersion: 1.25,
  vibrancy: 1.5,
  highlightWidth: 1,
  highlightAlpha: 0.5,
  highlightAngle: 45,
};

/** A pane in device px; `x`/`y` are its top-left in the viewport. */
export type GlassPane = {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  variant: GlassVariant;
};

/**
 * One draw of the frame: the tinted water into the page canvas, or one pane into its canvas —
 * whole ("pane") or only its rim highlight ("rim", which ignores viewport, position and tint).
 */
export type GlassDraw =
  | { kind: "background"; target: GPUTexture; dpr: number; tint: Rgba }
  | {
      kind: "pane" | "rim";
      target: GPUTexture;
      /** Viewport size, device px (the water textures cover it). */
      viewport: { width: number; height: number };
      pane: GlassPane;
      dpr: number;
      tint: Rgba;
      options: GlassOptions;
    };

/** `struct Uniforms` in liquid-glass.wgsl. */
const UNIFORM_FLOATS = 24;

/**
 * Builds the background + glass pipelines once. `water` is the sharp background and `blurred`
 * the same, pre-blurred; both cover the viewport. Bind them with `bind()` whenever they change
 * (rim-only draws don't read them, but the layout still needs textures bound).
 * `encode()` records every glass draw of a frame: one uniform upload (a slot per draw, selected
 * with a dynamic offset) and one render pass per target.
 */
export function createLiquidGlass(device: GPUDevice, format: GPUTextureFormat) {
  const module = device.createShaderModule({ code: shaderCode });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      {
        binding: 3,
        visibility: GPUShaderStage.FRAGMENT,
        buffer: { hasDynamicOffset: true },
      },
    ],
  });
  const layout = device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });
  const pipeline = (entryPoint: string) =>
    device.createRenderPipeline({
      layout,
      vertex: { module, entryPoint: "vs_main" },
      fragment: { module, entryPoint, targets: [{ format }] },
      primitive: { topology: "triangle-list" },
    });
  const pipelines = {
    background: pipeline("fs_background"),
    pane: pipeline("fs_glass"),
    rim: pipeline("fs_rim"),
  };

  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "clamp-to-edge",
    addressModeV: "clamp-to-edge",
  });

  const alignment = device.limits.minUniformBufferOffsetAlignment;
  const stride = Math.ceil((UNIFORM_FLOATS * 4) / alignment) * alignment;
  let capacity = 0;
  let uniforms: GPUBuffer | undefined;
  let data = new Float32Array(0);
  let textures: [GPUTexture, GPUTexture] | undefined;
  let bindGroup: GPUBindGroup | undefined;

  function reserve(slots: number) {
    if (slots <= capacity) return;
    capacity = Math.max(slots, capacity * 2, 8);
    uniforms?.destroy();
    uniforms = device.createBuffer({
      label: "glass uniforms",
      size: capacity * stride,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    data = new Float32Array((capacity * stride) / 4);
    bindGroup = undefined;
  }

  function write(offset: number, draw: GlassDraw) {
    const slot = data.subarray(offset, offset + UNIFORM_FLOATS);
    slot.fill(0);
    if (draw.kind === "background") {
      slot.set([draw.target.width, draw.target.height], 0);
    } else {
      const { viewport, pane, options: o } = draw;
      slot.set(
        [
          viewport.width,
          viewport.height,
          pane.x,
          pane.y,
          pane.width,
          pane.height,
        ],
        0,
      );
      slot[6] = pane.radius;
      slot.set(SURFACE[pane.variant], 8);
      slot.set(
        [o.refractionHeight, o.refractionAmount, o.depth, o.dispersion],
        16,
      );
      slot.set(
        [o.vibrancy, o.highlightWidth, o.highlightAlpha, o.highlightAngle],
        20,
      );
    }
    slot[7] = draw.dpr;
    slot.set(draw.tint, 12);
  }

  return {
    bind(water: GPUTexture, blurred: GPUTexture) {
      textures = [water, blurred];
      bindGroup = undefined;
    },

    encode(encoder: GPUCommandEncoder, draws: GlassDraw[]) {
      if (!draws.length || !textures) return;
      reserve(draws.length);
      bindGroup ??= device.createBindGroup({
        layout: bindGroupLayout,
        entries: [
          { binding: 0, resource: textures[0].createView() },
          { binding: 1, resource: textures[1].createView() },
          { binding: 2, resource: sampler },
          {
            binding: 3,
            resource: { buffer: uniforms!, size: UNIFORM_FLOATS * 4 },
          },
        ],
      });
      draws.forEach((draw, i) => write((i * stride) / 4, draw));
      device.queue.writeBuffer(
        uniforms!,
        0,
        data,
        0,
        (draws.length * stride) / 4,
      );

      draws.forEach((draw, i) => {
        const pass = encoder.beginRenderPass({
          label: `glass ${draw.kind}`,
          colorAttachments: [
            {
              view: draw.target.createView(),
              loadOp: "clear",
              clearValue: { r: 0, g: 0, b: 0, a: 0 },
              storeOp: "store",
            },
          ],
        });
        pass.setPipeline(pipelines[draw.kind]);
        pass.setBindGroup(0, bindGroup!, [i * stride]);
        pass.draw(3);
        pass.end();
      });
    },

    destroy() {
      uniforms?.destroy();
    },
  };
}
