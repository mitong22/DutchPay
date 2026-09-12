import { notFound } from "next/navigation";
import { connection } from "next/server";

import ReceiptForm from "@/app/groups/[groupId]/receipts/receipt-form";
import { getGroupContext } from "@/lib/auth-context";
import { getReceiptEditorData } from "@/lib/group-service";
import { isTemporaryReceiptDataEnabled } from "@/lib/temporary-receipt-config";
import { userIdsEqual } from "@/lib/utils/user-id.mjs";

export const metadata = {
  title: "영수증 추가",
};

export default async function NewReceiptPage({ params }) {
  await connection();
  const { groupId } = await params;
  const context = await getGroupContext(groupId);

  if (!context || context.group.status !== "ACTIVE") {
    notFound();
  }

  const { members } = await getReceiptEditorData(groupId);
  const owner = members.find(
    (member) =>
      member.member_type === "registered" &&
      userIdsEqual(member.user_id, context.group.created_by),
  );

  if (!owner) {
    notFound();
  }

  // Teacher: Client 폼에 필요한 두 필드만 보내지만 _id를 id로 다시 이름 붙여 화면·서버가 서로 다른 이름을 씁니다. 업무 데이터 _id는 이미 UUID 문자열입니다. AGENTS.md의 원본 문서 전달 기준과 비교해, DB projection으로 필요한 필드만 조회하고 _id 이름을 유지하는 방식이 더 단순한지 검토해 보세요.
  const memberInputs = members.map((member) => ({
    id: member._id,
    nickname: member.nickname,
  }));
  const defaultPayerId =
    context.group.mode === "SOLO" ? owner._id : context.member._id;
  const allMemberIds = members.map((member) => member._id);

  return (
    <ReceiptForm
      group={{
        id: context.group._id,
        name: context.group.name,
        mode: context.group.mode,
      }}
      members={memberInputs}
      temporaryReceiptDataEnabled={isTemporaryReceiptDataEnabled()}
      initialReceipt={{
        id: "",
        storeName: "",
        paidByMemberId: defaultPayerId,
        participantMemberIds: allMemberIds,
        items: [
          {
            id: "",
            menuName: "",
            lineTotal: "",
            consumerMemberIds: allMemberIds,
          },
        ],
      }}
    />
  );
}
