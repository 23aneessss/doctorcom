import { expo } from "@better-auth/expo";
import { db } from "@doctor.com/db";
import * as schema from "@doctor.com/db/schema/auth";
import { env } from "@doctor.com/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export const betterAuthConfigPlaceholder = {
  basePath: "/api/auth",
  // TODO(phase-2): finalize providers and authentication flows.
  provider: "better-auth-placeholder",
} as const;

export const auth = betterAuth({
  basePath: betterAuthConfigPlaceholder.basePath,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  trustedOrigins: [
    env.CORS_ORIGIN,
    "doctor.com://",
    ...(env.NODE_ENV === "development"
      ? ["exp://", "exp://**", "exp://192.168.*.*:*/**", "http://localhost:8081"]
      : []),
  ],
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },
  plugins: [expo()],
});
