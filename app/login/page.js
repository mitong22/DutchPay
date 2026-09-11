import { redirect } from "next/navigation";

import LoginPage from "@/component/pages/loginPage";
import { getCurrentUser } from "@/lib/auth"; // 현재 유저 정보 가져오기

export default async function Login() {
  if (await getCurrentUser()) { // 1. 현재 유저가 있다면
    redirect("/dashboard"); // 1-1. 대시보드로 이동
  }

  return <LoginPage />; // 1-2. 없다면 로그인 페이지 반환
}
