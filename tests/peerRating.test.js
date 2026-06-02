import { test } from "node:test";
import assert from "node:assert/strict";
import { BadRequestError } from "../src/exceptions/BadRequestError.js";
import { ForbiddenError } from "../src/exceptions/ForbiddenError.js";

/** Validación de rating (lógica extraída del servicio). */
function validatePeerRating(rating, completerId, raterUserId) {
  const q = Math.round(Number(rating));
  if (!Number.isFinite(q) || q < 1 || q > 5) {
    throw new BadRequestError("La valoración debe ser entre 1 y 5 estrellas.");
  }
  if (completerId === raterUserId) {
    throw new ForbiddenError("No puedes calificar una tarea que tú completaste.");
  }
  return q;
}

test("validatePeerRating accepts 1-5", () => {
  assert.equal(validatePeerRating(4, 2, 1), 4);
  assert.equal(validatePeerRating("5", 2, 1), 5);
});

test("validatePeerRating rejects out of range", () => {
  assert.throws(() => validatePeerRating(0, 2, 1), BadRequestError);
  assert.throws(() => validatePeerRating(6, 2, 1), BadRequestError);
});

test("validatePeerRating rejects self-rating", () => {
  assert.throws(() => validatePeerRating(5, 1, 1), ForbiddenError);
});
