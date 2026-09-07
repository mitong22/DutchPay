import { connection } from "next/server";

import { db } from "@/lib/db";

export default async function SelectDb() {
  if (process.env.NODE_ENV === "production") {
    return <p>사용자 목록은 개발 환경에서만 표시됩니다.</p>;
  }

  await connection();

  const users = await db
    .collection("user")
    .find(
      {},
      {
        projection: {
          name: 1,
          email: 1,
          emailVerified: 1,
          createdAt: 1,
        },
      },
    )
    .sort({ createdAt: -1 })
    .limit(100)
    .toArray();

  return (
    <section>
      <h1>MongoDB user collection</h1>
      <p>총 {users.length}명</p>

      {users.length === 0 ? (
        <p>등록된 사용자가 없습니다.</p>
      ) : (
        <table>
          <caption>최근 사용자 최대 100명</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">이름</th>
              <th scope="col">이메일</th>
              <th scope="col">이메일 인증</th>
              <th scope="col">가입일</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user._id.toString()}>
                <td>{user._id.toString()}</td>
                <td>{user.name ?? "-"}</td>
                <td>{user.email}</td>
                <td>{user.emailVerified ? "완료" : "미완료"}</td>
                <td>
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleString("ko-KR")
                    : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
