CREATE TABLE "categories_pre_rempli" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "pre_rempli_medicaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pre_rempli_id" uuid NOT NULL,
	"medicament_nom" varchar(255) NOT NULL,
	"posologie_defaut" varchar(255),
	"duree_defaut" varchar(255),
	"instructions_defaut" text,
	"ordre_affichage" integer,
	"est_optionnel" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pre_rempli_ordonnance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(255) NOT NULL,
	"description" text,
	"specialite" varchar(255),
	"categorie_pre_rempli_id" uuid NOT NULL,
	"est_actif" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordonnance" ADD COLUMN "pre_rempli_origine_id" uuid;--> statement-breakpoint
ALTER TABLE "pre_rempli_medicaments" ADD CONSTRAINT "pre_rempli_medicaments_pre_rempli_id_pre_rempli_ordonnance_id_fk" FOREIGN KEY ("pre_rempli_id") REFERENCES "public"."pre_rempli_ordonnance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_rempli_ordonnance" ADD CONSTRAINT "pre_rempli_ordonnance_categorie_pre_rempli_id_categories_pre_rempli_id_fk" FOREIGN KEY ("categorie_pre_rempli_id") REFERENCES "public"."categories_pre_rempli"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pre_rempli_ordonnance" ADD CONSTRAINT "pre_rempli_ordonnance_created_by_user_utilisateurs_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pre_rempli_medicaments_pre_rempli_id_idx" ON "pre_rempli_medicaments" USING btree ("pre_rempli_id");--> statement-breakpoint
CREATE INDEX "pre_rempli_ordonnance_categorie_pre_rempli_id_idx" ON "pre_rempli_ordonnance" USING btree ("categorie_pre_rempli_id");--> statement-breakpoint
CREATE INDEX "pre_rempli_ordonnance_created_by_user_idx" ON "pre_rempli_ordonnance" USING btree ("created_by_user");--> statement-breakpoint
ALTER TABLE "ordonnance" ADD CONSTRAINT "ordonnance_pre_rempli_origine_id_pre_rempli_ordonnance_id_fk" FOREIGN KEY ("pre_rempli_origine_id") REFERENCES "public"."pre_rempli_ordonnance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ordonnance_pre_rempli_origine_id_idx" ON "ordonnance" USING btree ("pre_rempli_origine_id");