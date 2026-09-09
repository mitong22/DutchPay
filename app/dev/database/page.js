import { notFound } from "next/navigation";
import { connection } from "next/server";

import { db } from "@/lib/db";

export const metadata = {
  title: "개발용 DB 확인",
};

export default async function DatabasePage() {
  await connection();

  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const users = await db
    .collection("user")
    .find({}, { projection: { name: 1, email: 1, emailVerified: 1 } })
    .sort({ name: 1, _id: 1 })
    .toArray();

  return (
    <main className="page-shell simple-page">
      <div className="section-heading">
        <span className="eyebrow">개발 전용</span>
        <h1>Better Auth 사용자 확인</h1>
        <p>프로덕션 환경에서는 이 경로가 열리지 않습니다.</p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>이메일</th>
              <th>인증 여부</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id.toString()}>
                <td>{user.name || "-"}</td>
                <td>{user.email}</td>
                <td>{user.emailVerified ? "인증" : "미인증"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
