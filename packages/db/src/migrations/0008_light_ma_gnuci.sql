ALTER TABLE "patients" ADD COLUMN "assure" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "patients" SET "assure" = true WHERE "revenu_mensuel" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "suivi" ADD COLUMN "symptoms" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
UPDATE "suivi" SET "symptoms" = ARRAY["suivi"."motif"] WHERE "motif" IS NOT NULL AND "motif" <> '';
