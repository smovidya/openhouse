import shaderCode from "./blur.wgsl?raw";

const MAX_TAPS = 48;

/**
 * Separable Gaussian blur between same-format textures. Returns a function that blurs `src` into
 * `dst` (via `tmp`, which must match `dst`'s size); `sigma` is in `dst` texels.
 */
export function createBlur(device: GPUDevice, format: GPUTextureFormat) {
	const module = device.createShaderModule({ code: shaderCode });
	const pipeline = device.createRenderPipeline({
		layout: "auto",
		vertex: { module, entryPoint: "vs_main" },
		fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
		primitive: { topology: "triangle-list" },
	});
	const sampler = device.createSampler({
		magFilter: "nearest",
		minFilter: "nearest",
		addressModeU: "mirror-repeat",
		addressModeV: "mirror-repeat",
	});
	const passes = [0, 1].map(() =>
		device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST })
	);
	const data = new ArrayBuffer(16);
	const f32 = new Float32Array(data);
	const u32 = new Uint32Array(data);

	function pass(encoder: GPUCommandEncoder, src: GPUTexture, dst: GPUTexture, uniforms: GPUBuffer) {
		const bindGroup = device.createBindGroup({
			layout: pipeline.getBindGroupLayout(0),
			entries: [
				{ binding: 0, resource: src.createView() },
				{ binding: 1, resource: sampler },
				{ binding: 2, resource: { buffer: uniforms } },
			],
		});
		const p = encoder.beginRenderPass({
			colorAttachments: [{ view: dst.createView(), loadOp: "clear", storeOp: "store" }],
		});
		p.setPipeline(pipeline);
		p.setBindGroup(0, bindGroup);
		p.draw(3);
		p.end();
	}

	return function blur(src: GPUTexture, tmp: GPUTexture, dst: GPUTexture, sigma: number) {
		// Never below ~half a texel: when dst is smaller than src this doubles as the downsample
		// prefilter (a single bilinear tap would alias and shimmer).
		sigma = Math.max(sigma, 0.5);
		const taps = Math.min(MAX_TAPS, Math.ceil(sigma * 3));
		// Horizontal: src (any size, sampled by UV) → tmp. Vertical: tmp → dst.
		const steps: [number, number][] = [
			[1 / dst.width, 0],
			[0, 1 / dst.height],
		];
		steps.forEach((step, i) => {
			f32[0] = step[0];
			f32[1] = step[1];
			f32[2] = sigma;
			u32[3] = taps;
			device.queue.writeBuffer(passes[i], 0, data);
		});
		const encoder = device.createCommandEncoder();
		pass(encoder, src, tmp, passes[0]);
		pass(encoder, tmp, dst, passes[1]);
		device.queue.submit([encoder.finish()]);
	};
}
