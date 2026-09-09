import Link from "next/link";

import InviteSlot from "@/app/groups/[groupId]/invite-slot";

function formatExpiration(expiresAt) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(expiresAt);
}

export default function WaitingRoom({
  group,
  members,
  invites,
  currentMemberId,
  isOwner,
}) {
  const progress = Math.round(
    (members.length / group.expected_member_count) * 100,
  );
  const unusedInvites = invites.filter((invite) => !invite.member_id);

  return (
    <main className="page-shell waiting-page">
      <section className="waiting-card">
        <div className="waiting-card__heading">
          <span className="waiting-illustration" aria-hidden="true">
            👥
          </span>
          <span className="eyebrow">함께하기 · 참여 대기</span>
          <h1>{group.name}</h1>
          <p>모든 참여자가 들어오면 영수증 등록과 정산이 열립니다.</p>
        </div>

        <div className="join-progress" aria-label={`${progress}% 참여 완료`}>
          <div>
            <strong>
              {members.length} / {group.expected_member_count}명
            </strong>
            <span>참여 완료</span>
          </div>
          <div className="join-progress__track">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>

        <ul className="waiting-members">
          {members.map((member) => (
            <li key={member._id}>
              <span className="member-avatar" aria-hidden="true">
                {member.nickname.slice(0, 1)}
              </span>
              <strong>{member.nickname}</strong>
              {member._id === currentMemberId ? <em>나</em> : null}
              {member.member_type === "registered" ? <em>모임장</em> : null}
              <span className="joined-label">참여 완료</span>
            </li>
          ))}
          {Array.from({
            length: group.expected_member_count - members.length,
          }).map((value, index) => (
            <li className="is-empty" key={`waiting-${index}`}>
              <span className="member-avatar" aria-hidden="true">
                ?
              </span>
              <strong>참여자 대기 중</strong>
              <span className="joined-label">미참여</span>
            </li>
          ))}
        </ul>

        {isOwner ? (
          <div className="invite-manager">
            <div className="invite-manager__heading">
              <div>
                <strong>초대 링크 관리</strong>
                <p>
                  원본 링크는 저장하지 않습니다. 링크를 잃어버렸다면 해당 자리를
                  재발급한 뒤 새 링크를 전달하세요.
                </p>
              </div>
              <span>{unusedInvites.length}자리 대기</span>
            </div>
            <div className="invite-slot-list">
              {unusedInvites.map((invite, index) => (
                <InviteSlot
                  groupId={group._id}
                  inviteId={invite._id}
                  slotNumber={index + 1}
                  expiresAt={formatExpiration(invite.expires_at)}
                  key={invite._id}
                />
              ))}
              {unusedInvites.length === 0 ? (
                <p className="compact-empty">모든 초대 자리가 사용되었습니다.</p>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="waiting-help">
            모임장이 다른 참여자를 초대하고 있습니다. 모두 입장한 뒤 이 페이지를
            새로고침해 주세요.
          </p>
        )}

        <Link className="button button--quiet" href="/">
          홈으로
        </Link>
      </section>
    </main>
  );
}
