import { env } from "@doctor.com/env/web";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: new URL("/api/auth", env.VITE_SERVER_URL).toString(),
});
