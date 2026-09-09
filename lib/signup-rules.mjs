const MAX_NAME_LENGTH = 30;
const MAX_EMAIL_LENGTH = 254;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupInput({
  name,
  email,
  password,
  passwordConfirmation,
}) {
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedEmail =
    typeof email === "string" ? email.trim().toLowerCase() : "";
  const normalizedPassword = typeof password === "string" ? password : "";

  if (!normalizedName) {
    throw new Error("이름을 입력해 주세요.");
  }

  if (normalizedName.length > MAX_NAME_LENGTH) {
    throw new Error(`이름은 ${MAX_NAME_LENGTH}자 이하로 입력해 주세요.`);
  }

  if (!normalizedEmail) {
    throw new Error("이메일을 입력해 주세요.");
  }

  if (
    normalizedEmail.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(normalizedEmail)
  ) {
    throw new Error("올바른 이메일 주소를 입력해 주세요.");
  }

  if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new Error(
      `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상으로 입력해 주세요.`,
    );
  }

  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `비밀번호는 ${MAX_PASSWORD_LENGTH}자 이하로 입력해 주세요.`,
    );
  }

  if (passwordConfirmation !== normalizedPassword) {
    throw new Error("비밀번호 확인이 일치하지 않습니다.");
  }

  return {
    name: normalizedName,
    email: normalizedEmail,
    password: normalizedPassword,
  };
}
