import { redirect } from "@tanstack/react-router";

import { authClient } from "@/lib/auth-client";

export async function requireSession() {
  try {
    const session = await authClient.getSession();

    if (!session.data) {
      redirect({ to: "/login", throw: true });
    }

    return session;
  } catch {
    redirect({ to: "/login", throw: true });
  }
}
