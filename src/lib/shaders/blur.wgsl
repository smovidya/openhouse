// One direction of a separable Gaussian blur. Run twice (horizontal, then vertical).

struct Uniforms {
  step: vec2f,  // one source texel along the blur direction, in UV
  sigma: f32,   // standard deviation, in source texels
  taps: u32,    // samples on each side of the centre
};

@group(0) @binding(0) var src: texture_2d<f32>;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var<uniform> u: Uniforms;

struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(@builtin(vertex_index) i: u32) -> VsOut {
  // Fullscreen triangle.
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  var out: VsOut;
  out.position = vec4f(p * 2.0 - 1.0, 0.0, 1.0);
  out.uv = vec2f(p.x, 1.0 - p.y);
  return out;
}

@fragment fn fs_main(in: VsOut) -> @location(0) vec4f {
  var acc = textureSampleLevel(src, samp, in.uv, 0.0);
  var total = 1.0;
  for (var i = 1u; i <= u.taps; i++) {
    let x = f32(i);
    let w = exp(-(x * x) / (2.0 * u.sigma * u.sigma));
    acc += w * (textureSampleLevel(src, samp, in.uv + u.step * x, 0.0) +
                textureSampleLevel(src, samp, in.uv - u.step * x, 0.0));
    total += 2.0 * w;
  }
  return acc / total;
}
