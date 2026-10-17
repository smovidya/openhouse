import shaderCode from "./liquid-glass.wgsl?raw";

export type GlassVariant = "dark" | "light";

/** Surface fill drawn over the refracted backdrop, [r, g, b, alpha]. */
const SURFACE: Record<GlassVariant, [number, number, number, number]> = {
	dark: [0, 0, 0, 0.3], // Figma card-black
	light: [1, 1, 1, 0.15],
};

type Rgba = [number, number, number, number];

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
	refractionAmount: 100,
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
 * Builds the background + glass pipelines once. `water` is the sharp background and `blurred`
 * the same, pre-blurred; both cover the viewport. Bind them with `bind()` whenever they change.
 */
export function createLiquidGlass(device: GPUDevice, format: GPUTextureFormat) {
	const module = device.createShaderModule({ code: shaderCode });
	const bindGroupLayout = device.createBindGroupLayout({
		entries: [
			{ binding: 0, visibility: GPUShaderStage.FRAGMENT, texture: {} },
			{ binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
			{ binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
			{ binding: 3, visibility: GPUShaderStage.FRAGMENT, buffer: {} },
		],
	});
	const layout = device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] });
	const pipeline = (entryPoint: string) =>
		device.createRenderPipeline({
			layout,
			vertex: { module, entryPoint: "vs_main" },
			fragment: { module, entryPoint, targets: [{ format }] },
			primitive: { topology: "triangle-list" },
		});
	const backgroundPipeline = pipeline("fs_background");
	const glassPipeline = pipeline("fs_glass");

	const sampler = device.createSampler({
		magFilter: "linear",
		minFilter: "linear",
		addressModeU: "clamp-to-edge",
		addressModeV: "clamp-to-edge",
	});
	const uniforms = device.createBuffer({
		size: 96,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	const data = new Float32Array(24);
	let bindGroup: GPUBindGroup | undefined;

	// One submit per draw: the queue orders each writeBuffer before the submit that follows it.
	function draw(target: GPUTexture, pipe: GPURenderPipeline) {
		device.queue.writeBuffer(uniforms, 0, data);
		const encoder = device.createCommandEncoder();
		const pass = encoder.beginRenderPass({
			colorAttachments: [
				{
					view: target.createView(),
					loadOp: "clear",
					clearValue: { r: 0, g: 0, b: 0, a: 0 },
					storeOp: "store",
				},
			],
		});
		pass.setPipeline(pipe);
		pass.setBindGroup(0, bindGroup!);
		pass.draw(3);
		pass.end();
		device.queue.submit([encoder.finish()]);
	}

	return {
		bind(water: GPUTexture, blurred: GPUTexture) {
			bindGroup = device.createBindGroup({
				layout: bindGroupLayout,
				entries: [
					{ binding: 0, resource: water.createView() },
					{ binding: 1, resource: blurred.createView() },
					{ binding: 2, resource: sampler },
					{ binding: 3, resource: { buffer: uniforms } },
				],
			});
		},

		/** Full-viewport tinted water. `tint`: [r, g, b, opacity] in 0–1. */
		background(target: GPUTexture, dpr: number, tint: Rgba) {
			data.fill(0);
			data.set([target.width, target.height], 0);
			data[7] = dpr;
			data.set(tint, 12);
			draw(target, backgroundPipeline);
		},

		/** One pane into its own canvas texture (sized to the pane). */
		glass(
			target: GPUTexture,
			viewport: { width: number; height: number },
			pane: GlassPane,
			dpr: number,
			tint: Rgba,
			options: GlassOptions
		) {
			data.set([viewport.width, viewport.height, pane.x, pane.y, pane.width, pane.height], 0);
			data[6] = pane.radius;
			data[7] = dpr;
			data.set(SURFACE[pane.variant], 8);
			data.set(tint, 12);
			const o = options;
			data.set([o.refractionHeight, o.refractionAmount, o.depth, o.dispersion], 16);
			data.set([o.vibrancy, o.highlightWidth, o.highlightAlpha, o.highlightAngle], 20);
			draw(target, glassPipeline);
		},
	};
}
