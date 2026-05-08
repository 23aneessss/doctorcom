import type { db as databaseClient } from "@doctor.com/db";
import { appSettings } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

import {
  DEFAULT_APP_AI_SETTINGS_ID,
  type PreferredAIProvider,
} from "../shared/provider";

type DatabaseClient = typeof databaseClient;

export type AppAISettingsRecord = typeof appSettings.$inferSelect;

export interface AppAISettingsUpdate {
  ai_provider?: PreferredAIProvider;
  gemini_api_key?: string | null;
}

export class AISettingsRepository {
  async get(database: DatabaseClient): Promise<AppAISettingsRecord | null> {
    const [settings] = await database
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, DEFAULT_APP_AI_SETTINGS_ID))
      .limit(1);

    return settings ?? null;
  }

  async ensure(database: DatabaseClient): Promise<AppAISettingsRecord> {
    const existing = await this.get(database);
    if (existing) {
      return existing;
    }

    const [created] = await database
      .insert(appSettings)
      .values({
        id: DEFAULT_APP_AI_SETTINGS_ID,
        ai_provider: "gemini",
        gemini_api_key: null,
      })
      .returning();

    if (!created) {
      throw new Error("Unable to initialize app AI settings.");
    }

    return created;
  }

  async update(
    database: DatabaseClient,
    input: AppAISettingsUpdate,
  ): Promise<AppAISettingsRecord> {
    await this.ensure(database);

    const [updated] = await database
      .update(appSettings)
      .set({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .where(eq(appSettings.id, DEFAULT_APP_AI_SETTINGS_ID))
      .returning();

    if (!updated) {
      throw new Error("Unable to update app AI settings.");
    }

    return updated;
  }
}

export const aiSettingsRepository = new AISettingsRepository();
