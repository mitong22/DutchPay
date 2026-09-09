"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { validateSignupInput } from "@/lib/signup-rules.mjs";

export async function signUpAction(previousState, formData) {
  let signupInput;

  try {
    signupInput = validateSignupInput({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      passwordConfirmation: formData.get("password_confirmation"),
    });
  } catch (error) {
    return {
      message:
        error instanceof Error
          ? error.message
          : "회원가입 정보를 다시 확인해 주세요.",
    };
  }

  try {
    await auth.api.signUpEmail({
      body: signupInput,
      headers: await headers(),
    });
  } catch {
    return {
      message: "회원가입에 실패했습니다. 이미 가입된 이메일인지 확인해 주세요.",
    };
  }

  redirect("/");
}

export async function signInAction(previousState, formData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !password) {
    return { message: "이메일과 비밀번호를 모두 입력해 주세요." };
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
        rememberMe: true,
      },
      headers: await headers(),
    });
  } catch {
    return { message: "이메일 또는 비밀번호를 확인해 주세요." };
  }

  redirect("/");
}

export async function signOutAction() {
  try {
    await auth.api.signOut({ headers: await headers() });
  } catch {
    // 이미 세션이 끝난 경우에도 홈으로 이동한다.
  }

  redirect("/");
}
