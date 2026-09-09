import "server-only";

import { randomUUID } from "node:crypto";

import { ApplicationError } from "@/lib/application-error";
import { requireGroupContext } from "@/lib/auth-context";
import { db, runInTransaction } from "@/lib/db";
import { validateReceiptDraft } from "@/lib/receipt-rules.mjs";
import { chooseRandomRemainderRecipientIds } from "@/lib/settlement-rules.mjs";

function haveSameMemberIds(firstMemberIds, secondMemberIds) {
  if (firstMemberIds.length !== secondMemberIds.length) {
    return false;
  }

  const secondMemberIdSet = new Set(secondMemberIds);
  return firstMemberIds.every((memberId) => secondMemberIdSet.has(memberId));
}

function ensureActiveGroup(group) {
  if (group.status !== "ACTIVE") {
    throw new ApplicationError(
      "모든 참여자가 입장한 뒤 영수증을 관리할 수 있습니다.",
    );
  }
}

function canManageReceipt(context, receipt) {
  if (context.isOwner) {
    return true;
  }

  return (
    context.group.mode === "TOGETHER" &&
    receipt.uploaded_by_member_id === context.member._id
  );
}

async function getReceiptMutationContext(groupId) {
  const context = await requireGroupContext(groupId);
  ensureActiveGroup(context.group);

  const members = await db
    .collection("group_member")
    .find({ group_id: groupId })
    .toArray();
  const ownerMember = members.find(
    (member) =>
      member.member_type === "registered" &&
      member.user_id === context.group.created_by,
  );

  if (!ownerMember) {
    throw new ApplicationError("모임의 총대 정보를 찾을 수 없습니다.");
  }

  return { context, members, ownerMember };
}

function buildItems(menuInputs, existingItems = []) {
  const existingItemById = new Map(
    existingItems.map((item) => [item._id, item]),
  );
  const usedItemIds = new Set();

  return menuInputs.map((menuInput) => {
    let itemId = menuInput.itemId;
    let existingItem = null;

    if (itemId) {
      existingItem = existingItemById.get(itemId);

      if (!existingItem || usedItemIds.has(itemId)) {
        throw new ApplicationError("유효하지 않은 메뉴 항목이 포함되어 있습니다.");
      }
    } else {
      itemId = randomUUID();
    }

    usedItemIds.add(itemId);

    const settlementInputsUnchanged =
      existingItem !== null &&
      existingItem.line_total === menuInput.lineTotal &&
      haveSameMemberIds(
        existingItem.consumer_member_ids,
        menuInput.consumerMemberIds,
      );
    const remainderRecipientMemberIds = settlementInputsUnchanged
      ? existingItem.remainder_recipient_member_ids
      : chooseRandomRemainderRecipientIds({
          lineTotal: menuInput.lineTotal,
          consumerMemberIds: menuInput.consumerMemberIds,
        });

    return {
      document: {
        _id: itemId,
        menu_name: menuInput.menuName,
        quantity: 1,
        unit_price: menuInput.lineTotal,
        line_total: menuInput.lineTotal,
        consumer_member_ids: menuInput.consumerMemberIds,
        remainder_recipient_member_ids: remainderRecipientMemberIds,
      },
      settlementInputsUnchanged,
    };
  });
}

function buildPayments({
  groupId,
  receiptId,
  paidByMemberId,
  itemResults,
  existingPayments = [],
  createdAt,
}) {
  const existingPaymentByItemAndPayer = new Map(
    existingPayments.map((payment) => [
      `${payment.expense_item_id}:${payment.payer_member_id}`,
      payment,
    ]),
  );

  return itemResults.flatMap((itemResult) =>
    itemResult.document.consumer_member_ids.map((consumerMemberId) => {
      const existingPayment = existingPaymentByItemAndPayer.get(
        `${itemResult.document._id}:${consumerMemberId}`,
      );
      const canPreserveExistingStatus =
        itemResult.settlementInputsUnchanged &&
        existingPayment?.payee_member_id === paidByMemberId;
      const status =
        consumerMemberId === paidByMemberId
          ? "paid"
          : canPreserveExistingStatus
            ? existingPayment.status
            : "unpaid";

      return {
        _id: existingPayment?._id ?? randomUUID(),
        group_id: groupId,
        receipt_id: receiptId,
        expense_item_id: itemResult.document._id,
        payer_member_id: consumerMemberId,
        payee_member_id: paidByMemberId,
        status,
        created_at: existingPayment?.created_at ?? createdAt,
        ...(existingPayment?.seed_metadata
          ? { seed_metadata: existingPayment.seed_metadata }
          : {}),
      };
    }),
  );
}

function validateDraftForGroup({
  rawDraft,
  context,
  members,
  ownerMember,
}) {
  try {
    return validateReceiptDraft({
      ...rawDraft,
      uploadedByMemberId: context.member._id,
      allowedMemberIds: members.map((member) => member._id),
      mode: context.group.mode,
      ownerMemberId: ownerMember._id,
    });
  } catch (error) {
    if (error instanceof ApplicationError) {
      throw error;
    }

    throw new ApplicationError(
      "영수증 입력값을 확인해 주세요. 금액은 10원 단위이며 메뉴 참여자는 영수증 참여자 안에서 선택해야 합니다.",
      "INVALID_RECEIPT",
    );
  }
}

export async function createReceipt({ groupId, rawDraft }) {
  const { context, members, ownerMember } =
    await getReceiptMutationContext(groupId);
  const draft = validateDraftForGroup({
    rawDraft,
    context,
    members,
    ownerMember,
  });
  const receiptId = randomUUID();
  const itemResults = buildItems(draft.menuInputs);
  const createdAt = new Date();
  const receiptDocument = {
    _id: receiptId,
    group_id: groupId,
    store_name: draft.storeName,
    total_amount: draft.totalAmount,
    paid_by_member_id: draft.paidByMemberId,
    uploaded_by_member_id: context.member._id,
    participant_member_ids: draft.participantMemberIds,
    items: itemResults.map((itemResult) => itemResult.document),
  };
  const paymentDocuments = buildPayments({
    groupId,
    receiptId,
    paidByMemberId: draft.paidByMemberId,
    itemResults,
    createdAt,
  });

  await runInTransaction(async (session) => {
    await db.collection("receipts").insertOne(receiptDocument, { session });
    await db.collection("payment").insertMany(paymentDocuments, { session });
    await db.collection("expense_group").updateOne(
      { _id: groupId },
      { $set: { updated_at: createdAt } },
      { session },
    );
  });

  return receiptId;
}

export async function updateReceipt({ groupId, receiptId, rawDraft }) {
  const { context, members, ownerMember } =
    await getReceiptMutationContext(groupId);
  const [receipt, existingPayments] = await Promise.all([
    db.collection("receipts").findOne({
      _id: receiptId,
      group_id: groupId,
    }),
    db
      .collection("payment")
      .find({ receipt_id: receiptId, group_id: groupId })
      .toArray(),
  ]);

  if (!receipt) {
    throw new ApplicationError("수정할 영수증을 찾을 수 없습니다.");
  }

  if (!canManageReceipt(context, receipt)) {
    throw new ApplicationError("이 영수증을 수정할 권한이 없습니다.");
  }

  const draft = validateDraftForGroup({
    rawDraft,
    context,
    members,
    ownerMember,
  });
  const itemResults = buildItems(draft.menuInputs, receipt.items);
  const updatedAt = new Date();
  const paymentDocuments = buildPayments({
    groupId,
    receiptId,
    paidByMemberId: draft.paidByMemberId,
    itemResults,
    existingPayments,
    createdAt: updatedAt,
  });

  await runInTransaction(async (session) => {
    await db.collection("receipts").updateOne(
      { _id: receiptId, group_id: groupId },
      {
        $set: {
          store_name: draft.storeName,
          total_amount: draft.totalAmount,
          paid_by_member_id: draft.paidByMemberId,
          participant_member_ids: draft.participantMemberIds,
          items: itemResults.map((itemResult) => itemResult.document),
        },
      },
      { session },
    );
    await db
      .collection("payment")
      .deleteMany({ receipt_id: receiptId, group_id: groupId }, { session });
    await db.collection("payment").insertMany(paymentDocuments, { session });
    await db.collection("expense_group").updateOne(
      { _id: groupId },
      { $set: { updated_at: updatedAt } },
      { session },
    );
  });
}

export async function deleteReceipt({ groupId, receiptId }) {
  const context = await requireGroupContext(groupId);
  ensureActiveGroup(context.group);
  const receipt = await db.collection("receipts").findOne({
    _id: receiptId,
    group_id: groupId,
  });

  if (!receipt) {
    throw new ApplicationError("삭제할 영수증을 찾을 수 없습니다.");
  }

  if (!canManageReceipt(context, receipt)) {
    throw new ApplicationError("이 영수증을 삭제할 권한이 없습니다.");
  }

  const updatedAt = new Date();

  await runInTransaction(async (session) => {
    await db
      .collection("receipts")
      .deleteOne({ _id: receiptId, group_id: groupId }, { session });
    await db
      .collection("payment")
      .deleteMany({ receipt_id: receiptId, group_id: groupId }, { session });
    await db.collection("expense_group").updateOne(
      { _id: groupId },
      { $set: { updated_at: updatedAt } },
      { session },
    );
  });
}

export async function updatePaymentStatus({ groupId, paymentId, status }) {
  if (status !== "paid" && status !== "unpaid") {
    throw new ApplicationError("올바르지 않은 정산 상태입니다.");
  }

  const context = await requireGroupContext(groupId);
  ensureActiveGroup(context.group);
  const payment = await db.collection("payment").findOne({
    _id: paymentId,
    group_id: groupId,
  });

  if (!payment) {
    throw new ApplicationError("정산 상태를 찾을 수 없습니다.");
  }

  if (!context.isOwner && payment.payer_member_id !== context.member._id) {
    throw new ApplicationError("이 정산 상태를 변경할 권한이 없습니다.");
  }

  await db.collection("payment").updateOne(
    { _id: paymentId, group_id: groupId },
    { $set: { status } },
  );
}

export function mayManageReceipt(context, receipt) {
  return canManageReceipt(context, receipt);
}
