import assert from "node:assert/strict";
import test from "node:test";

import seedModule from "../scripts/seeds.js";

const { buildSeedDocuments, createSeedPreview } = seedModule;

test("seed data covers SOLO, TOGETHER WAITING, and migrated TOGETHER ACTIVE", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const modes = seedDocuments.expenseGroups.map((group) => group.mode);
  const statuses = seedDocuments.expenseGroups.map((group) => group.status);

  assert.deepEqual(modes, ["SOLO", "TOGETHER", "TOGETHER"]);
  assert.deepEqual(statuses, ["ACTIVE", "WAITING", "ACTIVE"]);
  assert.equal(seedDocuments.expenseGroups.some((group) => group.mode === "shared"), false);
  assert.equal(seedDocuments.groupMembers.length, 11);
});

test("every seed group has one registered owner and stores no member_ids array", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");

  for (const group of seedDocuments.expenseGroups) {
    const groupMembers = seedDocuments.groupMembers.filter(
      (member) => member.group_id === group._id,
    );
    const registeredMembers = groupMembers.filter(
      (member) => member.member_type === "registered",
    );

    assert.equal(registeredMembers.length, 1);
    assert.equal(registeredMembers[0].user_id, "better-auth-owner-id");
    assert.equal(Object.hasOwn(group, "member_ids"), false);
  }
});

test("seed preview is read-only and reports member counts without identifiers", async () => {
  const seedDocuments = await buildSeedDocuments("better-auth-owner-id");
  const preview = createSeedPreview(seedDocuments);

  assert.equal(preview.writesToDatabase, false);
  assert.equal(preview.collections.expense_group, 3);
  assert.equal(preview.collections.group_member, 11);
  assert.deepEqual(
    preview.groups.map((group) => group.joinedMemberCount),
    [4, 3, 4],
  );
  assert.equal(JSON.stringify(preview).includes("better-auth-owner-id"), false);
});
