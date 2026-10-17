import shaderCode from "./blur.wgsl?raw";

/** The glass backdrop stays at quarter resolution per axis. */
export const BLUR_DOWNSCALE = 4;

/**
 * Dual Kawase blur: 2–4 quarter-size downsample levels, then upsample back to 1/4 size.
 * `encode` takes an approximate Gaussian-equivalent sigma in source pixels and records the passes
 * into the caller's encoder (uniforms are written immediately: encode at most once per submit).
 * The caller owns src/dst; dst must be ceil(src / BLUR_DOWNSCALE), in the given format.
 */
export function createBlur(
  device: GPUDevice,
  format: GPUTextureFormat,
  levels: 2 | 3 | 4 = 4,
) {
  const module = device.createShaderModule({ code: shaderCode });
  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
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
  const downsample = pipeline("fs_downsample");
  const upsample = pipeline("fs_upsample");
  const sampler = device.createSampler({
    magFilter: "linear",
    minFilter: "linear",
    addressModeU: "mirror-repeat",
    addressModeV: "mirror-repeat",
  });
  type Pass = {
    pipeline: GPURenderPipeline;
    bindGroup: GPUBindGroup;
    target: GPUTextureView;
    uniforms: GPUBuffer;
    step: [number, number];
    minimumStep: [number, number];
  };
  let textures: GPUTexture[] = [];
  let passes: Pass[] = [];
  let source: GPUTexture | undefined;
  let destination: GPUTexture | undefined;
  let lastSigma = NaN;
  let varianceX = 0;
  let varianceY = 0;
  const data = new Float32Array(4);

  function release() {
    for (const texture of textures) texture.destroy();
    for (const pass of passes) pass.uniforms.destroy();
    textures = [];
    passes = [];
    source = destination = undefined;
    lastSigma = NaN;
  }

  function prepare(src: GPUTexture, dst: GPUTexture) {
    release();
    varianceX = varianceY = 0;
    const pyramid = [src];
    for (let level = 1; level <= levels; level++) {
      // Reuse the output as level 1, and reuse the deeper levels on the way up.
      const texture =
        level === 1
          ? dst
          : device.createTexture({
              size: [
                Math.max(1, Math.ceil(src.width / BLUR_DOWNSCALE ** level)),
                Math.max(1, Math.ceil(src.height / BLUR_DOWNSCALE ** level)),
              ],
              format,
              usage:
                GPUTextureUsage.RENDER_ATTACHMENT |
                GPUTextureUsage.TEXTURE_BINDING,
            });
      pyramid.push(texture);
      if (level !== 1) textures.push(texture);
    }
    const views = pyramid.map((texture) => texture.createView());
    function addPass(
      from: number,
      to: number,
      pipe: GPURenderPipeline,
      variance: number,
    ) {
      const input = pyramid[from];
      const uniforms = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      passes.push({
        pipeline: pipe,
        target: views[to],
        uniforms,
        step: [0.5 / input.width, 0.5 / input.height],
        // Cover the 4x4 source footprint even at small blur settings. Without this,
        // 4x decimation samples only the centre and can shimmer as the water moves.
        minimumStep:
          pipe === downsample
            ? [0.25 / pyramid[to].width, 0.25 / pyramid[to].height]
            : [0, 0],
        bindGroup: device.createBindGroup({
          layout: bindGroupLayout,
          entries: [
            { binding: 0, resource: views[from] },
            { binding: 1, resource: sampler },
            { binding: 2, resource: { buffer: uniforms } },
          ],
        }),
      });
      // Kernel second moments in full-resolution pixels. Bilinear filtering adds some
      // extra softness, so this preserves the old control's scale approximately.
      varianceX += variance * ((0.5 * src.width) / input.width) ** 2;
      varianceY += variance * ((0.5 * src.height) / input.height) ** 2;
    }
    for (let level = 1; level <= levels; level++)
      addPass(level - 1, level, downsample, 0.5);
    for (let level = levels; level > 1; level--)
      addPass(level, level - 1, upsample, 4 / 3);
    source = src;
    destination = dst;
  }

  return {
    encode(
      encoder: GPUCommandEncoder,
      src: GPUTexture,
      dst: GPUTexture,
      sigma: number,
    ) {
      if (src !== source || dst !== destination) prepare(src, dst);
      sigma = Number.isFinite(sigma) ? Math.max(0, sigma) : 0;
      if (sigma !== lastSigma) {
        const offsetX = sigma / Math.sqrt(varianceX);
        const offsetY = sigma / Math.sqrt(varianceY);
        for (const pass of passes) {
          data[0] = Math.max(pass.minimumStep[0], pass.step[0] * offsetX);
          data[1] = Math.max(pass.minimumStep[1], pass.step[1] * offsetY);
          device.queue.writeBuffer(pass.uniforms, 0, data);
        }
        lastSigma = sigma;
      }
      for (const pass of passes) {
        const render = encoder.beginRenderPass({
          label: "blur",
          colorAttachments: [
            { view: pass.target, loadOp: "clear", storeOp: "store" },
          ],
        });
        render.setPipeline(pass.pipeline);
        render.setBindGroup(0, pass.bindGroup);
        render.draw(3);
        render.end();
      }
    },
    destroy: release,
  };
}
