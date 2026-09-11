import "server-only";

import { mongodbAdapter } from "@better-auth/mongo-adapter";
import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { headers } from "next/headers";
import { cache } from "react";

import { client, db } from "./db.js";

export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  plugins: [username({ displayUsername: false }), nextCookies()],
});

function mapSessionUser(user) {
  if (!user) return null;

  return {
    id: user.id,
    user_id: user.id,
    nickname: user.name,
    member_type: "registered",
  };
}

export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() }),
);

export const getCurrentUser = cache(async () =>
  mapSessionUser((await getSession())?.user),
);

export async function getRequestUser(request) {
  const session = await auth.api.getSession({ headers: request.headers });
  return mapSessionUser(session?.user);
}
