import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 55990af re-vendored the canonical spatial instrument and silently removed the
// code that emits rec.board. check-portable.mjs reads rec.board, so the CI floor
// could never pass, while every unit test (which feeds synthetic rows) stayed
// green. This asserts the REAL producer still produces what the consumer needs.
const src = readFileSync(new URL("../scripts/spatial/spatial-check.mjs", import.meta.url), "utf8");
const consumer = readFileSync(new URL("../scripts/spatial/check-portable.mjs", import.meta.url), "utf8");

test("the instrument emits every board field the portable floor reads", () => {
  for (const field of ["metricEvidence", "metrics:", "brief:", "funnel:", "map:", "state:"]) {
    assert.ok(src.includes(field), `spatial-check.mjs no longer produces board.${field}`);
  }
  assert.match(src, /import \{ measureMetricEvidence \}/, "metric probe is not imported");
  assert.match(src, /\.replace\("__METRIC_PROBE__", measureMetricEvidence\.toString\(\)\)/, "metric probe is not injected into the harness");
  for (const read of ["board.metricEvidence", "board.state", "board.funnel"]) {
    assert.ok(consumer.includes(read) || consumer.includes(read.replace("board.", "board?.")), `portable floor stopped reading ${read}`);
  }
});

test("a dropped local patch is announced, not silent", () => {
  assert.ok((src.match(/LOCAL PATCH/g) || []).length >= 5);
});
