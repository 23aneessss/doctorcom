import { authClient } from "@/lib/auth-client";

import { AIAssistantPanel } from "./AIAssistantPanel";

export function GlobalAIAssistant() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending || !session) {
    return null;
  }

  return <AIAssistantPanel />;
}
