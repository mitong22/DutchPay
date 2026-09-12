import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import ReceiptDetail from "@/app/groups/[groupId]/receipt-detail";
import ReceiptList from "@/app/groups/[groupId]/receipt-list";
import SettlementPanel from "@/app/groups/[groupId]/settlement-panel";
import WaitingRoom from "@/app/groups/[groupId]/waiting-room";
import { getGroupContext } from "@/lib/auth-context";
import { getGroupWorkspaceData } from "@/lib/group-service";
import { mayManageReceipt } from "@/lib/receipt-service";
import { calculateGroupSettlement } from "@/lib/settlement-summary.mjs";

export const metadata = {
  title: "정산 모임",
};

export default async function GroupPage({ params, searchParams }) {
  // Teacher: connection은 이 페이지 아래 작업을 요청 시점에 실행하도록 하는 표시입니다. Server Component라는 실행 위치와는 구분하세요. params.groupId는 모임 조회 조건, searchParams.receipt는 선택할 영수증이며 URL을 바꾸면 서버에서 이 흐름을 다시 실행합니다.
  await connection();
  const [{ groupId }, query] = await Promise.all([params, searchParams]);
  const context = await getGroupContext(groupId);

  if (!context) {
    notFound();
  }

  const selectedReceiptId =
    typeof query.receipt === "string" ? query.receipt : null;
  // Teacher: 페이지가 회원·영수증·초대·결제 정보를 한꺼번에 읽어 여러 Server Component에 전달합니다. AGENTS.md는 실제 데이터를 쓰는 Server Component에서 조회하고 props를 최소화하도록 합니다. WAITING 화면에서도 필요한 조회인지 나눠 보고, 공통 정산 계산에 필요한 데이터와 각 화면 전용 데이터를 AI와 함께 구분해 보세요.
  const workspace = await getGroupWorkspaceData(groupId, selectedReceiptId);

  if (context.group.status === "WAITING") {
    return (
      <WaitingRoom
        group={context.group}
        members={workspace.members}
        invites={workspace.invites}
        currentMemberId={context.member._id}
        isOwner={context.isOwner}
      />
    );
  }

  const memberNames = new Map(
    workspace.members.map((member) => [member._id, member.nickname]),
  );
  const settlement = calculateGroupSettlement({
    members: workspace.members,
    receipts: workspace.receipts,
  });

  return (
    <main className="page-shell group-page">
      <section className="group-heading">
        <div>
          <div className="group-heading__meta">
            <span className={`badge badge--${context.group.mode.toLowerCase()}`}>
              {context.group.mode === "SOLO" ? "혼자하기" : "함께하기"}
            </span>
            <span className="status-dot status-dot--active">정산 중</span>
          </div>
          <h1>{context.group.name}</h1>
          <p>
            현재 <strong>{context.member.nickname}</strong> 님으로 참여 중입니다.
          </p>
        </div>
        <Link className="button button--quiet" href="/">
          내 모임
        </Link>
      </section>

      <section className="group-members" aria-labelledby="group-member-title">
        <div>
          <span className="eyebrow">현재 모임</span>
          <h2 id="group-member-title">참여자 {workspace.members.length}명</h2>
        </div>
        <ul>
          {workspace.members.map((member) => (
            <li key={member._id}>
              <span className="member-avatar" aria-hidden="true">
                {member.nickname.slice(0, 1)}
              </span>
              <strong>{member.nickname}</strong>
              {member._id === context.member._id ? <em>나</em> : null}
              {member.member_type === "registered" ? <em>모임장</em> : null}
            </li>
          ))}
        </ul>
      </section>

      <div className="receipt-workspace">
        <ReceiptList
          groupId={groupId}
          receipts={workspace.receipts}
          selectedReceiptId={workspace.selectedReceipt?._id || null}
          memberNames={memberNames}
        />
        <ReceiptDetail
          groupId={groupId}
          receipt={workspace.selectedReceipt}
          payments={workspace.payments}
          memberNames={memberNames}
          currentMemberId={context.member._id}
          canManage={
            workspace.selectedReceipt
              ? mayManageReceipt(context, workspace.selectedReceipt)
              : false
          }
          isOwner={context.isOwner}
        />
      </div>

      <SettlementPanel
        settlement={settlement}
        memberNames={memberNames}
        currentMemberId={context.member._id}
      />
    </main>
  );
}
