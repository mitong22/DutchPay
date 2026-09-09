export const GROUP_MODE = Object.freeze({
  SOLO: "SOLO",
  TOGETHER: "TOGETHER",
});

export const GROUP_STATUS = Object.freeze({
  WAITING: "WAITING",
  ACTIVE: "ACTIVE",
});

const ALLOWED_GROUP_MODES = new Set(Object.values(GROUP_MODE));
const ALLOWED_GROUP_STATUSES = new Set(Object.values(GROUP_STATUS));

function assertValidDate(value, fieldName) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${fieldName} must be a valid Date.`);
  }

  return value;
}

function assertJoinedMemberCount(joinedMemberCount) {
  if (!Number.isInteger(joinedMemberCount) || joinedMemberCount < 1) {
    throw new RangeError("joinedMemberCount must be an integer greater than or equal to 1.");
  }

  return joinedMemberCount;
}

export function assertGroupMode(mode) {
  if (!ALLOWED_GROUP_MODES.has(mode)) {
    throw new TypeError('mode must be exactly "SOLO" or "TOGETHER".');
  }

  return mode;
}

export function assertGroupStatus(status) {
  if (!ALLOWED_GROUP_STATUSES.has(status)) {
    throw new TypeError('status must be exactly "WAITING" or "ACTIVE".');
  }

  return status;
}

export function assertExpectedMemberCount(mode, expectedMemberCount) {
  assertGroupMode(mode);

  if (!Number.isInteger(expectedMemberCount)) {
    throw new TypeError("expectedMemberCount must be an integer.");
  }

  const minimumCount = mode === GROUP_MODE.SOLO ? 1 : 2;

  if (expectedMemberCount < minimumCount) {
    throw new RangeError(
      `${mode} expectedMemberCount must be greater than or equal to ${minimumCount}.`,
    );
  }

  return expectedMemberCount;
}

export function createInitialGroupState({
  mode,
  expectedMemberCount,
  createdAt = new Date(),
}) {
  assertExpectedMemberCount(mode, expectedMemberCount);
  assertValidDate(createdAt, "createdAt");

  if (mode === GROUP_MODE.SOLO) {
    return {
      mode,
      status: GROUP_STATUS.ACTIVE,
      expected_member_count: expectedMemberCount,
      activated_at: new Date(createdAt.getTime()),
    };
  }

  return {
    mode,
    status: GROUP_STATUS.WAITING,
    expected_member_count: expectedMemberCount,
    activated_at: null,
  };
}

export function createSharedMigrationState({ memberCount, createdAt }) {
  assertExpectedMemberCount(GROUP_MODE.TOGETHER, memberCount);
  assertValidDate(createdAt, "createdAt");

  return {
    mode: GROUP_MODE.TOGETHER,
    status: GROUP_STATUS.ACTIVE,
    expected_member_count: memberCount,
    activated_at: new Date(createdAt.getTime()),
  };
}

export function shouldActivateTogetherGroup({
  mode,
  status,
  expectedMemberCount,
  joinedMemberCount,
}) {
  assertExpectedMemberCount(mode, expectedMemberCount);
  assertGroupStatus(status);
  assertJoinedMemberCount(joinedMemberCount);

  if (joinedMemberCount > expectedMemberCount) {
    throw new RangeError("joinedMemberCount cannot exceed expectedMemberCount.");
  }

  return (
    mode === GROUP_MODE.TOGETHER &&
    status === GROUP_STATUS.WAITING &&
    joinedMemberCount === expectedMemberCount
  );
}

export function validatePersistedGroupState({
  mode,
  status,
  expectedMemberCount,
  joinedMemberCount,
  activatedAt,
}) {
  assertExpectedMemberCount(mode, expectedMemberCount);
  assertGroupStatus(status);
  assertJoinedMemberCount(joinedMemberCount);

  if (joinedMemberCount > expectedMemberCount) {
    throw new RangeError("joinedMemberCount cannot exceed expectedMemberCount.");
  }

  if (mode === GROUP_MODE.SOLO) {
    if (status !== GROUP_STATUS.ACTIVE) {
      throw new Error("A SOLO group must be ACTIVE.");
    }

    if (joinedMemberCount !== expectedMemberCount) {
      throw new Error("A SOLO group must create all expected members at once.");
    }

    assertValidDate(activatedAt, "activatedAt");
    return true;
  }

  if (status === GROUP_STATUS.WAITING) {
    if (joinedMemberCount >= expectedMemberCount) {
      throw new Error("A full TOGETHER group cannot remain WAITING.");
    }

    if (activatedAt !== null) {
      throw new Error("A WAITING TOGETHER group must not have activatedAt.");
    }

    return true;
  }

  if (joinedMemberCount !== expectedMemberCount) {
    throw new Error("An ACTIVE TOGETHER group must have all expected members.");
  }

  assertValidDate(activatedAt, "activatedAt");
  return true;
}
