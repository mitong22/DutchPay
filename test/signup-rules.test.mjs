import assert from "node:assert/strict";
import test from "node:test";

import { validateSignupInput } from "../lib/signup-rules.mjs";

test("signup input trims the name and normalizes the email", () => {
  assert.deepEqual(
    validateSignupInput({
      name: "  시원  ",
      email: "  SIWON@EXAMPLE.COM ",
      password: "password123",
      passwordConfirmation: "password123",
    }),
    {
      name: "시원",
      email: "siwon@example.com",
      password: "password123",
    },
  );
});

test("signup requires a name", () => {
  assert.throws(
    () =>
      validateSignupInput({
        name: "   ",
        email: "siwon@example.com",
        password: "password123",
        passwordConfirmation: "password123",
      }),
    /이름을 입력/,
  );
});

test("signup rejects an invalid email address", () => {
  assert.throws(
    () =>
      validateSignupInput({
        name: "시원",
        email: "not-an-email",
        password: "password123",
        passwordConfirmation: "password123",
      }),
    /올바른 이메일/,
  );
});

test("signup rejects a password shorter than eight characters", () => {
  assert.throws(
    () =>
      validateSignupInput({
        name: "시원",
        email: "siwon@example.com",
        password: "1234567",
        passwordConfirmation: "1234567",
      }),
    /8자 이상/,
  );
});

test("signup rejects a password longer than 128 characters", () => {
  const password = "a".repeat(129);

  assert.throws(
    () =>
      validateSignupInput({
        name: "시원",
        email: "siwon@example.com",
        password,
        passwordConfirmation: password,
      }),
    /128자 이하/,
  );
});

test("signup requires the password confirmation to match", () => {
  assert.throws(
    () =>
      validateSignupInput({
        name: "시원",
        email: "siwon@example.com",
        password: "password123",
        passwordConfirmation: "different123",
      }),
    /일치하지 않습니다/,
  );
});
