import assert from "node:assert/strict";
import test from "node:test";

import {
  GROUP_MODE,
  GROUP_STATUS,
  assertGroupMode,
  createActivatedTogetherState,
  createInitialGroupState,
  createSharedMigrationState,
  shouldActivateTogetherGroup,
  validatePersistedGroupState,
} from "../lib/group-rules.mjs";

test("group mode accepts only the exact SOLO and TOGETHER values", () => {
  assert.equal(assertGroupMode("SOLO"), "SOLO");
  assert.equal(assertGroupMode("TOGETHER"), "TOGETHER");
  assert.throws(() => assertGroupMode("shared"), /SOLO.*TOGETHER/);
  assert.throws(() => assertGroupMode("solo"), /SOLO.*TOGETHER/);
});

test("a new SOLO group is ACTIVE immediately", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const state = createInitialGroupState({
    mode: GROUP_MODE.SOLO,
    expectedMemberCount: 4,
    createdAt,
  });

  assert.equal(state.status, GROUP_STATUS.ACTIVE);
  assert.equal(state.expected_member_count, 4);
  assert.deepEqual(state.activated_at, createdAt);
});

test("a new TOGETHER group is WAITING", () => {
  const state = createInitialGroupState({
    mode: GROUP_MODE.TOGETHER,
    expectedMemberCount: 4,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(state.status, GROUP_STATUS.WAITING);
  assert.equal(state.expected_member_count, 4);
  assert.equal(state.activated_at, null);
});

test("TOGETHER requires at least the owner and one invited member", () => {
  assert.throws(
    () =>
      createInitialGroupState({
        mode: GROUP_MODE.TOGETHER,
        expectedMemberCount: 1,
      }),
    /greater than or equal to 2/,
  );
});

test("a full WAITING TOGETHER group is ready to activate", () => {
  assert.equal(
    shouldActivateTogetherGroup({
      mode: GROUP_MODE.TOGETHER,
      status: GROUP_STATUS.WAITING,
      expectedMemberCount: 4,
      joinedMemberCount: 4,
    }),
    true,
  );

  assert.equal(
    shouldActivateTogetherGroup({
      mode: GROUP_MODE.TOGETHER,
      status: GROUP_STATUS.WAITING,
      expectedMemberCount: 4,
      joinedMemberCount: 3,
    }),
    false,
  );
});

test("joined member count cannot exceed the expected count", () => {
  assert.throws(
    () =>
      shouldActivateTogetherGroup({
        mode: GROUP_MODE.TOGETHER,
        status: GROUP_STATUS.WAITING,
        expectedMemberCount: 4,
        joinedMemberCount: 5,
      }),
    /cannot exceed/,
  );
});

test("a legacy shared group migrates to an ACTIVE TOGETHER state", () => {
  const createdAt = new Date("2026-01-01T00:00:00.000Z");
  const state = createSharedMigrationState({
    memberCount: 4,
    createdAt,
  });

  assert.deepEqual(state, {
    mode: GROUP_MODE.TOGETHER,
    status: GROUP_STATUS.ACTIVE,
    expected_member_count: 4,
    activated_at: createdAt,
  });

  assert.equal(
    validatePersistedGroupState({
      mode: state.mode,
      status: state.status,
      expectedMemberCount: state.expected_member_count,
      joinedMemberCount: 4,
      activatedAt: state.activated_at,
    }),
    true,
  );
});

test("a TOGETHER group activates only after every expected member joins", () => {
  const activatedAt = new Date("2026-01-01T01:00:00.000Z");

  assert.deepEqual(
    createActivatedTogetherState({
      expectedMemberCount: 4,
      joinedMemberCount: 4,
      activatedAt,
    }),
    {
      mode: GROUP_MODE.TOGETHER,
      status: GROUP_STATUS.ACTIVE,
      expected_member_count: 4,
      activated_at: activatedAt,
    },
  );
  assert.throws(
    () =>
      createActivatedTogetherState({
        expectedMemberCount: 4,
        joinedMemberCount: 3,
        activatedAt,
      }),
    /only when every expected member has joined/,
  );
});
