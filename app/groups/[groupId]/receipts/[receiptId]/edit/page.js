import { notFound } from "next/navigation";
import { connection } from "next/server";

import ReceiptForm from "@/app/groups/[groupId]/receipts/receipt-form";
import { getGroupContext } from "@/lib/auth-context";
import { getReceiptEditorData } from "@/lib/group-service";
import { mayManageReceipt } from "@/lib/receipt-service";

export const metadata = {
  title: "영수증 수정",
};

export default async function EditReceiptPage({ params }) {
  await connection();
  const { groupId, receiptId } = await params;
  const context = await getGroupContext(groupId);

  if (!context || context.group.status !== "ACTIVE") {
    notFound();
  }

  const { members, receipt } = await getReceiptEditorData(groupId, receiptId);

  if (!receipt || !mayManageReceipt(context, receipt)) {
    notFound();
  }

  return (
    <ReceiptForm
      group={{
        id: context.group._id,
        name: context.group.name,
        mode: context.group.mode,
      }}
      members={members.map((member) => ({
        id: member._id,
        nickname: member.nickname,
      }))}
      initialReceipt={{
        id: receipt._id,
        storeName: receipt.store_name,
        paidByMemberId: receipt.paid_by_member_id,
        participantMemberIds: receipt.participant_member_ids,
        items: receipt.items.map((item) => ({
          id: item._id,
          menuName: item.menu_name,
          lineTotal: String(item.line_total),
          consumerMemberIds: item.consumer_member_ids,
        })),
      }}
    />
  );
}
