ALTER TABLE "rendez_vous" ALTER COLUMN "suivi_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN "taille" numeric;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN "poids" numeric;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN "traitement_prescrit" text;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD COLUMN "description_consultation" text;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN "frequence_rappel" varchar(128);--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD COLUMN "periode_rappel" varchar(128);