diagnostic(off,derivative_uniformity);
struct Uniforms {
  frameData: vec4f,
  inputDimsAndPad: vec4f,
  waterColor: vec4f,
  highlightColor: vec4f,
  intensity: vec4f,
  playhead: vec4f,
  scale: vec4f,
  center: vec4f,
};
@group(0) @binding(0) var<uniform> u: Uniforms;

struct VsIn {
  @location(0) pos: vec2f,
  @location(1) uv: vec2f,
};
struct VsOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
};

@vertex fn vs_main(in: VsIn) -> VsOut {
  var out: VsOut;
  out.position = vec4f(in.pos, 0.0, 1.0);
  out.uv = in.uv;
  return out;
}

@fragment fn fs_main(@location(0) outputUv_in: vec2f) -> @location(0) vec4f {
  let outputUv = outputUv_in;
  let dims = max(u.frameData.yz, vec2f(1.0));
  let inputDims = max(u.inputDimsAndPad.xy, vec2f(1.0));
  let fragPx = outputUv * dims;
  let uvRaw = fragPx / inputDims;
  let waterColor = u.waterColor;
  let highlightColor = u.highlightColor;
  let intensity = u.intensity.x;
  let playhead = u.playhead.x;
  let scale = u.scale.x;
  let cx = u.center.x / 100.0;
  let cy = u.center.y / 100.0;
  let uv = (uvRaw - vec2f(cx, cy)) / scale + vec2f(1.0 - cx, 1.0 - cy);
  let TAU = 6.28318530718;
  let MAX_ITER = 5;
  let t_val = playhead * TAU / 100.0 + 23.0;
  // Convert UV to pixel space and normalize by the shorter dimension so the
  // pattern tiles at a consistent real-world scale regardless of aspect ratio.
  let minDim = min(dims.x, dims.y);
  let uvPx = uv * dims / minDim;
  let p = (fract(uvPx) * TAU) - 250.0;
  var i = p;
  var c = 1.0;
  let inten = mix(0.002519, 0.01178, intensity);
  for (var n = 0; n < MAX_ITER; n++) {
    let nt = t_val * f32(n + 1);
    i = p + vec2f(cos(nt - i.x) + sin(nt + i.y), sin(nt - i.y) + cos(nt + i.x));
    c += 1.0 / length(vec2f(p.x / (sin(i.x + nt) / inten), p.y / (cos(i.y + nt) / inten)));
  }
  c /= f32(MAX_ITER);
  c = 1.17 - pow(c, 1.4);
  let causticMask = clamp(pow(abs(c), 8.0), 0.0, 1.0);
  let alpha = mix(waterColor.a, highlightColor.a, causticMask);
  let colour = mix(waterColor.rgb, highlightColor.rgb, causticMask);
  return vec4f(colour * alpha, alpha);
}
