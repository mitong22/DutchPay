import { connection } from "next/server";

import HomeClient from "@/component/HomeClient";
import { getSession } from "@/lib/auth";
import { listGroups } from "@/lib/groups";

export default async function Home({ searchParams }) {
  await connection();
  const loginError = (await searchParams).loginError === "1";
  let user;
  let groups;

  try {
    const session = await getSession();
    user = session?.user
      ? {
          id: String(session.user.id),
          name: session.user.name,
          email: session.user.email,
        }
      : null;
    groups = user ? await listGroups(user.id) : [];
  } catch (error) {
    console.error(error);
    return (
      <main className="center-page">
        <section className="panel error-panel">
          <span className="brand-mark">몫</span>
          <h1>데이터베이스에 연결하지 못했어요</h1>
          <p>MongoDB Atlas 상태와 환경 변수를 확인한 뒤 새로고침해 주세요.</p>
        </section>
      </main>
    );
  }

  return (
    <HomeClient
      user={user}
      initialGroups={groups}
      loginError={loginError}
      demoEnabled={
        process.env.NODE_ENV !== "production" &&
        Boolean(process.env.DEMO_ACCOUNT_EMAIL && process.env.DEMO_ACCOUNT_PASSWORD)
      }
    />
  );
}
