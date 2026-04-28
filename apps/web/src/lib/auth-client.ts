import { createAuthClient } from "better-auth/react";

import { getServerBaseUrl } from "@/lib/server-url";

export const authClient = createAuthClient({
  baseURL: new URL("/api/auth", getServerBaseUrl()).toString(),
});
