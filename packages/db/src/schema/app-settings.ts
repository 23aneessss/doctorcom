import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const appSettings = pgTable("app_settings", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ai_provider: varchar("ai_provider", { length: 16 }).default("gemini").notNull(),
  gemini_api_key: text("gemini_api_key"),
  updated_at: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
  }).defaultNow().notNull(),
});
