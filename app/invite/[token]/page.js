import Link from "next/link";
import { connection } from "next/server";

import InviteForm from "@/app/invite/[token]/invite-form";
import { getInvitePreview } from "@/lib/invite-service";

export const metadata = {
  title: "모임 초대",
};

function InvalidInvite({ preview }) {
  return (
    <main className="page-shell invite-page">
      <section className="invite-card invite-card--center">
        <span className="invite-card__icon invite-card__icon--muted" aria-hidden="true">
          !
        </span>
        <span className="eyebrow">초대 확인</span>
        <h1>사용할 수 없는 초대 링크입니다.</h1>
        <p>
          {preview
            ? "초대가 만료되었거나 모임장이 취소했습니다. 모임장에게 새 링크를 요청해 주세요."
            : "주소가 잘못되었거나 존재하지 않는 초대입니다. 전달받은 주소를 다시 확인해 주세요."}
        </p>
        <Link className="button button--quiet" href="/">
          몫대로 홈으로
        </Link>
      </section>
    </main>
  );
}

export default async function InvitePage({ params }) {
  await connection();
  const { token } = await params;
  const preview = await getInvitePreview(token);

  if (!preview?.isUsable) {
    return <InvalidInvite preview={preview} />;
  }

  const joinedCountText = preview.member
    ? "이미 참여한 초대입니다. 본인이라면 다시 입장할 수 있어요."
    : "로그인 없이 별명만 정하면 바로 참여할 수 있어요.";

  return (
    <main className="page-shell invite-page">
      <section className="invite-card">
        <div className="invite-card__heading">
          <span className="invite-card__icon" aria-hidden="true">
            👋
          </span>
          <span className="eyebrow">모임 초대</span>
          <h1>{preview.group.name}</h1>
          <p>{joinedCountText}</p>
        </div>

        <div className="invite-summary">
          <div>
            <span>정산 방식</span>
            <strong>함께하기</strong>
          </div>
          <div>
            <span>예정 인원</span>
            <strong>{preview.group.expected_member_count}명</strong>
          </div>
          <div>
            <span>세션 기간</span>
            <strong>입장 후 7일</strong>
          </div>
        </div>

        <InviteForm token={token} member={preview.member} />
        <p className="security-note">
          이 링크는 한 사람의 참여 자리를 나타냅니다. 다른 사람에게 재전달하지
          마세요.
        </p>
      </section>
    </main>
  );
}
