import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  commitFrame,
  createFrameHistory,
  isIdle,
  planFrame,
  type FrameInputs,
  type PaneSnapshot,
} from "../src/lib/render/frame-plan";
import { DEFAULT_GLASS_OPTIONS } from "../src/lib/render/shaders/liquid-glass";

const pane = (overrides: Partial<PaneSnapshot> = {}): PaneSnapshot => ({
  id: {},
  context: {} as GPUCanvasContext,
  rect: { x: 0, y: 100, width: 300, height: 200 },
  radius: 16,
  variant: "dark",
  options: DEFAULT_GLASS_OPTIONS,
  onScreen: true,
  cleared: false,
  ...overrides,
});

const inputs = (overrides: Partial<FrameInputs> = {}): FrameInputs => ({
  time: 0,
  width: 800,
  height: 1600,
  dpr: 2,
  background: true,
  animate: false,
  glass: "full",
  blurSigma: 10,
  tint: [0.5, 0.7, 0.8, 0.5],
  panes: [],
  ...overrides,
});

/** Plan and commit, as one executed frame. */
function run(
  history: ReturnType<typeof createFrameHistory>,
  frame: FrameInputs,
) {
  const plan = planFrame(frame, history);
  commitFrame(history, plan);
  return plan;
}

describe("planFrame", () => {
  it("renders everything on the first frame, then idles", () => {
    const history = createFrameHistory();
    const card = pane();
    const first = run(history, inputs({ panes: [card] }));
    assert.deepEqual(first.water, { width: 400, height: 800 });
    assert.ok(first.caustics && first.blur && first.background);
    assert.deepEqual(first.panes, [card]);
    assert.ok(isIdle(run(history, inputs({ panes: [card] }))));
  });

  it("full glass: scrolling redraws only the panes", () => {
    const history = createFrameHistory();
    const card = pane();
    run(history, inputs({ panes: [card] }));
    const scrolled = run(
      history,
      inputs({ panes: [{ ...card, rect: { ...card.rect, y: 40 } }] }),
    );
    assert.equal(scrolled.caustics, null);
    assert.equal(scrolled.blur, null);
    assert.equal(scrolled.background, false);
    assert.equal(scrolled.panes.length, 1);
  });

  it("never draws panes off screen, even cleared ones, and draws them once they scroll in", () => {
    for (const glass of ["full", "rim"] as const) {
      const history = createFrameHistory();
      const card = pane({ onScreen: false, cleared: true });
      assert.equal(
        run(history, inputs({ glass, panes: [card] })).panes.length,
        0,
      );
      assert.equal(
        run(history, inputs({ glass, panes: [{ ...card, onScreen: true }] }))
          .panes.length,
        1,
      );
    }
  });

  it("animated water re-renders the chain every frame", () => {
    const history = createFrameHistory();
    const card = pane();
    run(history, inputs({ animate: true, panes: [card] }));
    const next = run(
      history,
      inputs({ animate: true, time: 16, panes: [card] }),
    );
    assert.ok(next.caustics && next.blur && next.background);
    assert.equal(next.panes.length, 1);
  });

  it("changing the blur re-blurs and redraws panes, not the water", () => {
    const history = createFrameHistory();
    const card = pane();
    run(history, inputs({ panes: [card] }));
    const plan = run(history, inputs({ blurSigma: 20, panes: [card] }));
    assert.equal(plan.caustics, null);
    assert.ok(plan.blur);
    assert.equal(plan.background, false);
    assert.equal(plan.panes.length, 1);
  });

  it("rim mode: no blur, and the rim ignores scrolling and the water", () => {
    const history = createFrameHistory();
    const card = pane();
    const first = run(history, inputs({ glass: "rim", panes: [card] }));
    assert.equal(first.blur, null);
    assert.equal(first.panes.length, 1);
    const scrolled = run(
      history,
      inputs({
        glass: "rim",
        tint: [0, 0, 0, 1],
        panes: [{ ...card, rect: { ...card.rect, y: 0 } }],
      }),
    );
    assert.equal(scrolled.panes.length, 0);
    const resized = run(
      history,
      inputs({
        glass: "rim",
        panes: [{ ...card, rect: { ...card.rect, width: 320 } }],
      }),
    );
    assert.equal(resized.panes.length, 1);
  });

  it("static background with rim glass needs no water at all", () => {
    const plan = planFrame(
      inputs({ background: false, glass: "rim", panes: [pane()] }),
      createFrameHistory(),
    );
    assert.equal(plan.water, null);
    assert.equal(plan.caustics, null);
    assert.equal(plan.background, false);
    assert.equal(plan.panes.length, 1);
  });

  it("css glass draws no panes", () => {
    const plan = planFrame(
      inputs({ glass: "css", panes: [pane()] }),
      createFrameHistory(),
    );
    assert.equal(plan.blur, null);
    assert.equal(plan.panes.length, 0);
  });

  it("resizing the viewport re-renders the water chain", () => {
    const history = createFrameHistory();
    run(history, inputs());
    const plan = run(history, inputs({ width: 1000 }));
    assert.ok(plan.caustics && plan.blur && plan.background);
  });
});
