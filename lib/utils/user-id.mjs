import { ObjectId } from "mongodb";

export function createUserIdCandidates(userId) {
  const stringUserId = String(userId || "").trim();

  if (!stringUserId) {
    return [];
  }

  if (!ObjectId.isValid(stringUserId)) {
    return [stringUserId];
  }

  return [stringUserId, ObjectId.createFromHexString(stringUserId)];
}

export function userIdsEqual(firstUserId, secondUserId) {
  if (firstUserId === null || firstUserId === undefined) {
    return false;
  }

  if (secondUserId === null || secondUserId === undefined) {
    return false;
  }

  return String(firstUserId) === String(secondUserId);
}
