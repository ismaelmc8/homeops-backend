import { test } from "node:test";
import assert from "node:assert/strict";
import { ForbiddenError } from "../src/exceptions/ForbiddenError.js";
import { UnauthorizedError } from "../src/exceptions/UnauthorizedError.js";

test("ForbiddenError represents 403 access denied", () => {
  const err = new ForbiddenError("Acceso denegado.");
  assert.equal(err.statusCode, 403);
  assert.match(err.message, /denegado/i);
});

test("UnauthorizedError represents 401 missing auth", () => {
  const err = new UnauthorizedError("Token requerido.");
  assert.equal(err.statusCode, 401);
});
