// Liquid glass, after Kyant0/AndroidLiquidGlass (Apache-2.0):
//   backdrop = vibrancy(tint(blurred water))  →  lens (circle-map refraction + dispersion)
//   → surface fill → thin additive highlight along the rim.
// Everything behind the glass is our own water, so no DOM capture is needed.
//
// Two entry points:
// - fs_background: the fixed, full-viewport canvas (tinted water).
// - fs_glass: one <Glass> pane, drawn into that pane's own canvas so the compositor scrolls it
//   with the card (no lag between the DOM and the glass edges).

struct Uniforms {
  viewport: vec2f, // viewport size, device px (water textures cover it)
  origin: vec2f,   // pane's top-left in the viewport, device px (fs_glass)
  size: vec2f,     // pane size, device px (fs_glass)
  radius: f32,     // pane corner radius, device px (fs_glass)
  dpr: f32,        // device px per CSS px
  fill: vec4f,     // pane surface colour, straight alpha (fs_glass)
  tint: vec4f,     // page tint over the water: rgb + opacity
  // Per-pane tunables (GlassOptions in liquid-glass.ts), lengths in CSS px:
  lens: vec4f,     // refractionHeight, refractionAmount, depth (0–1), dispersion (0–1)
  look: vec4f,     // vibrancy (saturation), highlightWidth, highlightAlpha, highlightAngle (deg)
};

@group(0) @binding(0) var water: texture_2d<f32>;   // sharp
@group(0) @binding(1) var blurred: texture_2d<f32>; // pre-blurred (see blur.wgsl)
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var<uniform> u: Uniforms;

@vertex fn vs_main(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  // Fullscreen triangle.
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}

fn sd_round_rect(p: vec2f, half: vec2f, r: f32) -> f32 {
  let q = abs(p) - (half - vec2f(r));
  return length(max(q, vec2f(0.0))) - r + min(max(q.x, q.y), 0.0);
}

// Analytic SDF gradient (outward normal) of a rounded rect.
fn grad_round_rect(p: vec2f, half: vec2f, r: f32) -> vec2f {
  let q = abs(p) - (half - vec2f(r));
  let s = select(vec2f(-1.0), vec2f(1.0), p >= vec2f(0.0));
  if (q.x >= 0.0 || q.y >= 0.0) {
    return s * normalize(max(q, vec2f(1e-6)));
  }
  let gx = step(q.y, q.x);
  return s * vec2f(gx, 1.0 - gx);
}

fn circle_map(x: f32) -> f32 {
  return 1.0 - sqrt(max(1.0 - x * x, 0.0));
}

fn over(dst: vec3f, src: vec3f, alpha: f32) -> vec3f {
  return mix(dst, src, clamp(alpha, 0.0, 1.0));
}

fn tinted(c: vec3f) -> vec3f {
  return over(c, u.tint.rgb, u.tint.a);
}

fn saturate_color(c: vec3f, s: f32) -> vec3f {
  let luma = dot(c, vec3f(0.213, 0.715, 0.072));
  return clamp(mix(vec3f(luma), c, s), vec3f(0.0), vec3f(1.0));
}

// What the glass sees at a viewport position (device px): blurred, tinted, saturated water.
fn backdrop(pos: vec2f) -> vec3f {
  let c = textureSampleLevel(blurred, samp, pos / u.viewport, 0.0).rgb;
  return saturate_color(tinted(c), u.look.x);
}

// 7-band spectral sampling along the dispersion offset.
fn dispersed(base: vec2f, off: vec2f) -> vec3f {
  let red = backdrop(base + off);
  let orange = backdrop(base + off * (2.0 / 3.0));
  let yellow = backdrop(base + off * (1.0 / 3.0));
  let green = backdrop(base);
  let cyan = backdrop(base - off * (1.0 / 3.0));
  let blue = backdrop(base - off * (2.0 / 3.0));
  let purple = backdrop(base - off);
  return vec3f(
    red.r / 3.5 + orange.r / 3.5 + yellow.r / 3.5 + purple.r / 7.0,
    orange.g / 7.0 + yellow.g / 3.5 + green.g / 3.5 + cyan.g / 3.5,
    cyan.b / 3.0 + blue.b / 3.0 + purple.b / 3.0,
  );
}

@fragment fn fs_background(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  return vec4f(tinted(textureSampleLevel(water, samp, frag.xy / u.viewport, 0.0).rgb), 1.0);
}

@fragment fn fs_glass(@builtin(position) frag: vec4f) -> @location(0) vec4f {
  let local = frag.xy;           // pane canvas px
  let px = u.origin + local;     // viewport px
  let half = u.size * 0.5;
  let p = local - half;
  let r = min(u.radius, min(half.x, half.y));
  let sd = sd_round_rect(p, half, r);
  let coverage = clamp(0.5 - sd / u.dpr, 0.0, 1.0); // anti-aliased edge
  if (coverage <= 0.0) {
    return vec4f(0.0);
  }
  let inside = max(-sd, 0.0);

  // Lens: only within the rim band; the flat interior just shows the backdrop.
  let height = min(u.lens.x * u.dpr, min(half.x, half.y));
  var glass: vec3f;
  if (inside >= height) {
    glass = backdrop(px);
  } else {
    let d = circle_map(1.0 - inside / height) * u.lens.y * u.dpr;
    // Normals from a rounder rect (1.5× radius) so corners bend smoothly.
    let grad_r = min(r * 1.5, min(half.x, half.y));
    let dir = normalize(grad_round_rect(p, half, grad_r) + u.lens.z * normalize(p + vec2f(1e-4)));
    let base = px - d * dir; // pull samples inward
    let spread = u.lens.w * (p.x * p.y) / (half.x * half.y);
    glass = dispersed(base, -d * dir * spread);
  }

  // Surface fill.
  glass = over(glass, u.fill.rgb, u.fill.a);

  // Highlight: thin rim stroke, intensity |n · light| (lights two opposite edges), added.
  let a = radians(u.look.w);
  let n = grad_round_rect(p, half, min(r * 1.5, min(half.x, half.y)));
  let lit = abs(dot(n, vec2f(cos(a), sin(a))));
  let w = u.look.y * u.dpr;
  let stroke = 1.0 - smoothstep(w * 0.5, w * 1.5, inside);
  glass = min(glass + vec3f(u.look.z * lit * stroke), vec3f(1.0));

  // Premultiplied output (canvas alphaMode "premultiplied").
  return vec4f(glass * coverage, coverage);
}
