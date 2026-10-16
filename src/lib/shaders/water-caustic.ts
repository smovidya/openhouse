// Figma "Water caustic" fill. The WGSL is verbatim from Figma; this replaces Figma's JS wrapper.
import shaderCode from "./water-caustic.wgsl?raw";

type RGBA = { r: number; g: number; b: number; a: number; };

export type WaterCausticParams = {
    /** Phase, 0–100. One full cycle loops seamlessly. */
    playhead: number;
    /** 0–1 */
    intensity: number;
    /** 1–5 */
    scale: number;
    /** Origin in % of the canvas. */
    center: { x: number; y: number; };
    waterColor: RGBA;
    highlightColor: RGBA;
};

// Full-screen quad: position.xy, uv.xy (uv origin top-left).
// prettier-ignore
const QUAD = new Float32Array([
    -1, -1, 0, 1,
    1, -1, 1, 1,
    -1, 1, 0, 0,
    -1, 1, 0, 0,
    1, -1, 1, 1,
    1, 1, 1, 0,
]);

/** Builds the pipeline once; returns a function that draws one frame into `target`. */
export function createWaterCaustic(device: GPUDevice, format: GPUTextureFormat) {
    const module = device.createShaderModule({ code: shaderCode });

    const quad = device.createBuffer({
        size: QUAD.byteLength,
        usage: GPUBufferUsage.VERTEX,
        mappedAtCreation: true,
    });
    new Float32Array(quad.getMappedRange()).set(QUAD);
    quad.unmap();

    // 8 × vec4f, matching `struct Uniforms` in the WGSL.
    const uniforms = device.createBuffer({
        size: 8 * 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const pipeline = device.createRenderPipeline({
        layout: "auto",
        vertex: {
            module,
            entryPoint: "vs_main",
            buffers: [
                {
                    arrayStride: 16,
                    attributes: [
                        { shaderLocation: 0, format: "float32x2", offset: 0 },
                        { shaderLocation: 1, format: "float32x2", offset: 8 },
                    ],
                },
            ],
        },
        fragment: { module, entryPoint: "fs_main", targets: [{ format }] },
        primitive: { topology: "triangle-list" },
    });

    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [{ binding: 0, resource: { buffer: uniforms } }],
    });

    return function render(target: GPUTexture, params: WaterCausticParams) {
        const { width, height } = target;
        const { waterColor: w, highlightColor: h } = params;
        // prettier-ignore
        device.queue.writeBuffer(uniforms, 0, new Float32Array([
            0, width, height, 0, // frameData: time, output size, pad
            width, height, 0, 0, // inputDimsAndPad
            w.r, w.g, w.b, w.a,
            h.r, h.g, h.b, h.a,
            params.intensity, 0, 0, 0,
            params.playhead, 0, 0, 0,
            params.scale, 0, 0, 0,
            params.center.x, params.center.y, 0, 0,
        ]));

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
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, quad);
        pass.draw(6);
        pass.end();
        device.queue.submit([encoder.finish()]);
    };
}
