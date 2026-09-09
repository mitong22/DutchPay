import Link from "next/link";
import { connection } from "next/server";

import { signOutAction } from "@/app/actions";
import GroupSetup from "@/app/group-setup";
import LoginForm from "@/app/login-form";
import { getSession } from "@/lib/auth";
import { listOwnedGroups } from "@/lib/group-service";

function ModeBadge({ mode }) {
  const isTogether = mode === "TOGETHER";

  return (
    <span className={`badge ${isTogether ? "badge--together" : "badge--solo"}`}>
      {isTogether ? "함께하기" : "혼자하기"}
    </span>
  );
}

function LoggedOutHome() {
  return (
    <main>
      <section className="hero page-shell">
        <div className="hero__copy">
          <span className="eyebrow">영수증 기반 더치페이</span>
          <h1>
            한 영수증 안에서도
            <br />
            <em>먹은 사람끼리만</em> 나눠요.
          </h1>
          <p>
            메뉴마다 참여자를 선택하면 몫대로가 10원 단위로 계산하고,
            마지막 송금 목록까지 한눈에 정리해 드립니다.
          </p>
          <div className="feature-row" aria-label="주요 기능">
            <span>메뉴별 참여자</span>
            <span>10원 단위 정산</span>
            <span>최소 송금 계산</span>
          </div>
        </div>
        <LoginForm />
      </section>

      <section className="page-shell how-it-works">
        <div className="section-heading">
          <span className="eyebrow">이용 방법</span>
          <h2>세 단계면 정산 준비가 끝나요</h2>
        </div>
        <ol className="process-grid">
          <li>
            <span>1</span>
            <strong>모임 만들기</strong>
            <p>혼자 입력하거나 친구들을 초대할 방식을 고릅니다.</p>
          </li>
          <li>
            <span>2</span>
            <strong>영수증 입력</strong>
            <p>메뉴, 금액, 결제자와 함께 먹은 사람을 기록합니다.</p>
          </li>
          <li>
            <span>3</span>
            <strong>송금 내역 확인</strong>
            <p>각자 낼 금액과 최종 송금 방향을 바로 확인합니다.</p>
          </li>
        </ol>
      </section>
    </main>
  );
}

function OwnedGroupList({ groups }) {
  if (groups.length === 0) {
    return (
      <div className="empty-state">
        <span aria-hidden="true">🧾</span>
        <strong>아직 만든 모임이 없습니다.</strong>
        <p>아래에서 첫 정산 모임을 만들어 보세요.</p>
      </div>
    );
  }

  return (
    <div className="group-card-grid">
      {groups.map((group) => (
        <Link className="group-card" href={`/groups/${group._id}`} key={group._id}>
          <div className="group-card__top">
            <ModeBadge mode={group.mode} />
            <span
              className={`status-dot ${group.status === "ACTIVE" ? "status-dot--active" : ""}`}
            >
              {group.status === "ACTIVE" ? "정산 중" : "참여 대기"}
            </span>
          </div>
          <strong>{group.name}</strong>
          <p>예정 인원 {group.expected_member_count}명</p>
          <span className="text-link">모임 열기 →</span>
        </Link>
      ))}
    </div>
  );
}

async function LoggedInHome({ session }) {
  const groups = await listOwnedGroups(session.user.id);
  const displayName = session.user.name || session.user.email;

  return (
    <main className="page-shell dashboard-page">
      <section className="dashboard-heading">
        <div>
          <span className="eyebrow">내 정산 공간</span>
          <h1>{displayName}님, 반가워요.</h1>
          <p>진행 중인 모임을 열거나 새로운 정산을 시작하세요.</p>
        </div>
        <form action={signOutAction}>
          <button className="button button--quiet" type="submit">
            로그아웃
          </button>
        </form>
      </section>

      <section className="dashboard-section" aria-labelledby="owned-groups-title">
        <div className="section-heading section-heading--row">
          <div>
            <span className="eyebrow">최근 모임</span>
            <h2 id="owned-groups-title">내가 만든 모임</h2>
          </div>
          <span className="count-label">{groups.length}개</span>
        </div>
        <OwnedGroupList groups={groups} />
      </section>

      <section className="dashboard-section" aria-labelledby="new-group-title">
        <div className="section-heading">
          <span className="eyebrow">새 정산</span>
          <h2 id="new-group-title">새 모임 만들기</h2>
          <p>상황에 맞는 방식을 선택해 시작하세요.</p>
        </div>
        <GroupSetup userName={session.user.name || ""} />
      </section>
    </main>
  );
}

export default async function HomePage() {
  await connection();
  const session = await getSession();

  return session?.user ? <LoggedInHome session={session} /> : <LoggedOutHome />;
}
