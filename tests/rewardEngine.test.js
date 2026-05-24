import test from "node:test";
import assert from "node:assert/strict";
import { calculateCoins } from "../src/services/rewardEngine.js";

test("preventive level 0-1 gives more coins than level 5", () => {
  const params = { difficulty: 2, durationMin: 10 };
  const low = calculateCoins({ ...params, dirtLevel: 1 });
  const high = calculateCoins({ ...params, dirtLevel: 5 });
  assert.ok(low.coins > high.coins, `expected ${low.coins} > ${high.coins}`);
});

test("level 1 yields ~12 coins illustrative", () => {
  const r = calculateCoins({ difficulty: 2, durationMin: 10, dirtLevel: 1 });
  assert.equal(r.coins, 12);
});

test("level 5 yields fewer coins than level 1", () => {
  const r5 = calculateCoins({ difficulty: 2, durationMin: 35, dirtLevel: 5 });
  assert.ok(r5.coins <= 7);
});
