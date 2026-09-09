import assert from "node:assert/strict";
import test from "node:test";

import { ObjectId } from "mongodb";

import {
  createUserIdCandidates,
  userIdsEqual,
} from "../lib/utils/user-id.mjs";

test("a Better Auth ObjectId string also produces a legacy ObjectId candidate", () => {
  const userId = "6a9e4548e57c70b4fecde9a9";
  const candidates = createUserIdCandidates(userId);

  assert.equal(candidates[0], userId);
  assert.ok(candidates[1] instanceof ObjectId);
  assert.equal(candidates[1].toString(), userId);
});

test("current UUID-like user IDs stay as strings", () => {
  assert.deepEqual(createUserIdCandidates("auth-user-id"), ["auth-user-id"]);
});

test("string and ObjectId references compare as the same user", () => {
  const userId = "6a9e4548e57c70b4fecde9a9";

  assert.equal(userIdsEqual(userId, new ObjectId(userId)), true);
  assert.equal(userIdsEqual(null, null), false);
});
