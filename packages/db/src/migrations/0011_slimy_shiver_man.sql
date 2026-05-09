CREATE TABLE "app_settings" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"ai_provider" varchar(16) DEFAULT 'gemini' NOT NULL,
	"gemini_api_key" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
