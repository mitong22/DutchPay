import { mongodbAdapter } from '@better-auth/mongo-adapter'
import { betterAuth } from 'better-auth'
import { nextCookies } from 'better-auth/next-js'
import { headers } from 'next/headers.js'
import { cache } from 'react'
import { client, db } from './db.js'


// user collection에 user insert해주는 부분
export const auth = betterAuth({
  database: mongodbAdapter(db, {
    client,
    transaction: false,
  }),
  emailAndPassword: {
    enabled: true,
  },
  baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
  plugins: [nextCookies()],
})

// 같은 요청에서 layout과 page가 세션을 읽어도 한 번만 조회한다.
export const getSession = cache(async function getSession() {
  return auth.api.getSession({ headers: await headers() })
})