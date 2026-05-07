ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN "logo_chemin_fichier" text;--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN "logo_type_fichier" varchar(64);--> statement-breakpoint
ALTER TABLE "ordonnance_pdf_templates" ADD COLUMN "logo_taille_fichier" integer;
