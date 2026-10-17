// Dual Kawase kernels: 5 bilinear samples down, 8 bilinear samples up.
// Based on Marius Bjorge's SIGGRAPH 2015 "Bandwidth-efficient graphics" dual filter.
struct Uniforms {
  step: vec2f, // half an input texel in UV, scaled by the blur offset
};

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(@builtin(vertex_index) i: u32) -> VsOut {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: VsOut;
  out.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

@fragment fn fs_downsample(in: VsOut) -> @location(0) vec4f {
  let d = u.step;
  var color = textureSampleLevel(src, samp, in.uv, 0.0) * 4.0;
  color += textureSampleLevel(src, samp, in.uv + vec2f(-d.x, -d.y), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f( d.x, -d.y), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f(-d.x,  d.y), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f( d.x,  d.y), 0.0);
  return color * 0.125;
}

@fragment fn fs_upsample(in: VsOut) -> @location(0) vec4f {
  let d = u.step;
  var color = textureSampleLevel(src, samp, in.uv + vec2f(-2.0 * d.x, 0.0), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f(2.0 * d.x, 0.0), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f(0.0, -2.0 * d.y), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f(0.0, 2.0 * d.y), 0.0);
  color += textureSampleLevel(src, samp, in.uv + vec2f(-d.x, -d.y), 0.0) * 2.0;
  color += textureSampleLevel(src, samp, in.uv + vec2f( d.x, -d.y), 0.0) * 2.0;
  color += textureSampleLevel(src, samp, in.uv + vec2f(-d.x,  d.y), 0.0) * 2.0;
  color += textureSampleLevel(src, samp, in.uv + vec2f( d.x,  d.y), 0.0) * 2.0;
  return color / 12.0;
}
