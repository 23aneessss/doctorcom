CREATE TYPE "public"."antecedent_type" AS ENUM('personnel', 'familial');--> statement-breakpoint
CREATE TYPE "public"."certificat_medical_statut" AS ENUM('brouillon', 'emis', 'annule');--> statement-breakpoint
CREATE TYPE "public"."certificat_medical_type" AS ENUM('arret_travail', 'aptitude', 'scolaire', 'grossesse', 'deces');--> statement-breakpoint
CREATE TYPE "public"."lettre_orientation_urgence" AS ENUM('normale', 'urgente', 'tres_urgente');--> statement-breakpoint
CREATE TYPE "public"."rendez_vous_statut" AS ENUM('planifie', 'confirme', 'termine', 'annule', 'non_present');--> statement-breakpoint
CREATE TYPE "public"."utilisateur_role" AS ENUM('medecin', 'secretaire', 'admin');--> statement-breakpoint
CREATE TABLE "antecedents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "antecedent_type" NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "antecedents_familiaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"antecedent_id" uuid NOT NULL,
	"details" text,
	"lien_parente" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "antecedents_personnels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"antecedent_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"details" text,
	"est_actif" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(255) NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "certificats_medicaux" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documents_patient_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"suivi_id" uuid NOT NULL,
	"type_certificat" "certificat_medical_type" NOT NULL,
	"date_emission" date NOT NULL,
	"date_debut" date,
	"date_fin" date,
	"diagnostic" text,
	"destinataire" varchar(255),
	"notes" text,
	"statut" "certificat_medical_statut" NOT NULL,
	"date_creation" timestamp with time zone NOT NULL,
	"date_modification" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents_patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"categorie_id" uuid NOT NULL,
	"type_document" varchar(128) NOT NULL,
	"nom_document" varchar(255) NOT NULL,
	"chemin_fichier" text NOT NULL,
	"type_fichier" varchar(64) NOT NULL,
	"taille_fichier" integer NOT NULL,
	"description" text,
	"date_upload" timestamp with time zone NOT NULL,
	"uploade_par_utilisateur" uuid NOT NULL,
	"est_archive" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "examen_consultation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rendez_vous_id" uuid NOT NULL,
	"suivi_id" uuid NOT NULL,
	"date" date NOT NULL,
	"aspect_general" text,
	"examen_respiratoire" text,
	"examen_cardiovasculaire" text,
	"examen_cutane_muqueux" text,
	"examen_orl" text,
	"examen_digestif" text,
	"examen_neurologique" text,
	"examen_locomoteur" text,
	"examen_genital" text,
	"examen_urinaire" text,
	"examen_ganglionnaire" text,
	"examen_endocrinien" text,
	"conclusion" text
);
--> statement-breakpoint
CREATE TABLE "historique_traitements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"medicament_id" uuid NOT NULL,
	"posologie" text NOT NULL,
	"est_actif" boolean NOT NULL,
	"date_prescription" date NOT NULL,
	"prescrit_par_utilisateur" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lettres_orientation" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documents_patient_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"suivi_id" uuid NOT NULL,
	"type_exploration" varchar(255),
	"examen_demande" text,
	"raison" text,
	"destinataire" varchar(255),
	"urgence" "lettre_orientation_urgence" NOT NULL,
	"contenu_lettre" text,
	"date_creation" timestamp with time zone NOT NULL,
	"date_modification" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"action" text NOT NULL,
	"horodatage" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dci" varchar(255) NOT NULL,
	"indication" text,
	"contre_indication" text,
	"posologie_standard" text,
	"effets_indesirables" text,
	"dosage" varchar(128)
);
--> statement-breakpoint
CREATE TABLE "ordonnance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rendez_vous_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"remarques" text,
	"date_prescription" date NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ordonnance_medicaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ordonnance_id" uuid NOT NULL,
	"medicament_id" uuid NOT NULL,
	"posologie" text NOT NULL,
	"duree_traitement" varchar(255),
	"instructions" text
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(255) NOT NULL,
	"prenom" varchar(255) NOT NULL,
	"telephone" varchar(32),
	"email" varchar(255),
	"matricule" varchar(128) NOT NULL,
	"date_naissance" date NOT NULL,
	"nss" integer,
	"lieu_naissance" varchar(255),
	"sexe" varchar(64),
	"nationalite" varchar(128),
	"groupe_sanguin" varchar(16),
	"adresse" text,
	"profession" varchar(255),
	"habitudes_saines" text,
	"habitudes_toxiques" text,
	"nb_enfants" integer,
	"situation_familiale" varchar(128),
	"age_circoncision" integer,
	"date_admission" date,
	"environnement_animal" text,
	"revenu_mensuel" numeric,
	"taille_menage" integer,
	"nb_pieces" integer,
	"niveau_intellectuel" varchar(128),
	"activite_sexuelle" boolean,
	"relations_environnement" text,
	"cree_par_utilisateur" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients_femmes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"menarche" integer,
	"regularite_cycles" varchar(255),
	"contraception" text,
	"nb_grossesses" integer,
	"nb_cesariennes" integer,
	"menopause" boolean,
	"age_menopause" integer,
	"symptomes_menopause" text
);
--> statement-breakpoint
CREATE TABLE "rendez_vous" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"suivi_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"date" date NOT NULL,
	"heure" varchar(16) NOT NULL,
	"statut" "rendez_vous_statut" NOT NULL,
	"important" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"jeton" text NOT NULL,
	"date_connexion" timestamp with time zone NOT NULL,
	"date_expiration" timestamp with time zone NOT NULL,
	"est_actif" boolean NOT NULL,
	"nom_appareil" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "suivi" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"utilisateur_id" uuid NOT NULL,
	"hypothese_diagnostic" text,
	"motif" text NOT NULL,
	"historique" text,
	"date_ouverture" date NOT NULL,
	"date_fermeture" date,
	"est_actif" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "utilisateurs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nom" varchar(255) NOT NULL,
	"prenom" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"adresse" text,
	"telephone" varchar(32),
	"mot_de_passe_hash" text NOT NULL,
	"date_creation" date NOT NULL,
	"role" "utilisateur_role" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vaccinations_patient" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"vaccin" varchar(255) NOT NULL,
	"date_vaccination" date NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "voyages_recents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"destination" varchar(255) NOT NULL,
	"date" date NOT NULL,
	"duree_jours" integer,
	"epidemies_destination" text
);
--> statement-breakpoint
ALTER TABLE "antecedents" ADD CONSTRAINT "antecedents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "antecedents_familiaux" ADD CONSTRAINT "antecedents_familiaux_antecedent_id_antecedents_id_fk" FOREIGN KEY ("antecedent_id") REFERENCES "public"."antecedents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "antecedents_personnels" ADD CONSTRAINT "antecedents_personnels_antecedent_id_antecedents_id_fk" FOREIGN KEY ("antecedent_id") REFERENCES "public"."antecedents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_medicaux" ADD CONSTRAINT "certificats_medicaux_documents_patient_id_documents_patient_id_fk" FOREIGN KEY ("documents_patient_id") REFERENCES "public"."documents_patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_medicaux" ADD CONSTRAINT "certificats_medicaux_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certificats_medicaux" ADD CONSTRAINT "certificats_medicaux_suivi_id_suivi_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_patient" ADD CONSTRAINT "documents_patient_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_patient" ADD CONSTRAINT "documents_patient_categorie_id_categories_documents_id_fk" FOREIGN KEY ("categorie_id") REFERENCES "public"."categories_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents_patient" ADD CONSTRAINT "documents_patient_uploade_par_utilisateur_utilisateurs_id_fk" FOREIGN KEY ("uploade_par_utilisateur") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD CONSTRAINT "examen_consultation_rendez_vous_id_rendez_vous_id_fk" FOREIGN KEY ("rendez_vous_id") REFERENCES "public"."rendez_vous"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "examen_consultation" ADD CONSTRAINT "examen_consultation_suivi_id_suivi_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD CONSTRAINT "historique_traitements_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD CONSTRAINT "historique_traitements_medicament_id_medicaments_id_fk" FOREIGN KEY ("medicament_id") REFERENCES "public"."medicaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historique_traitements" ADD CONSTRAINT "historique_traitements_prescrit_par_utilisateur_utilisateurs_id_fk" FOREIGN KEY ("prescrit_par_utilisateur") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lettres_orientation" ADD CONSTRAINT "lettres_orientation_documents_patient_id_documents_patient_id_fk" FOREIGN KEY ("documents_patient_id") REFERENCES "public"."documents_patient"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lettres_orientation" ADD CONSTRAINT "lettres_orientation_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lettres_orientation" ADD CONSTRAINT "lettres_orientation_suivi_id_suivi_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logs" ADD CONSTRAINT "logs_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnance" ADD CONSTRAINT "ordonnance_rendez_vous_id_rendez_vous_id_fk" FOREIGN KEY ("rendez_vous_id") REFERENCES "public"."rendez_vous"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnance" ADD CONSTRAINT "ordonnance_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnance" ADD CONSTRAINT "ordonnance_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ADD CONSTRAINT "ordonnance_medicaments_ordonnance_id_ordonnance_id_fk" FOREIGN KEY ("ordonnance_id") REFERENCES "public"."ordonnance"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ordonnance_medicaments" ADD CONSTRAINT "ordonnance_medicaments_medicament_id_medicaments_id_fk" FOREIGN KEY ("medicament_id") REFERENCES "public"."medicaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_cree_par_utilisateur_utilisateurs_id_fk" FOREIGN KEY ("cree_par_utilisateur") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients_femmes" ADD CONSTRAINT "patients_femmes_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_suivi_id_suivi_id_fk" FOREIGN KEY ("suivi_id") REFERENCES "public"."suivi"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rendez_vous" ADD CONSTRAINT "rendez_vous_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suivi" ADD CONSTRAINT "suivi_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suivi" ADD CONSTRAINT "suivi_utilisateur_id_utilisateurs_id_fk" FOREIGN KEY ("utilisateur_id") REFERENCES "public"."utilisateurs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vaccinations_patient" ADD CONSTRAINT "vaccinations_patient_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voyages_recents" ADD CONSTRAINT "voyages_recents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "antecedents_patient_id_idx" ON "antecedents" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "antecedents_familiaux_antecedent_id_idx" ON "antecedents_familiaux" USING btree ("antecedent_id");--> statement-breakpoint
CREATE INDEX "antecedents_personnels_antecedent_id_idx" ON "antecedents_personnels" USING btree ("antecedent_id");--> statement-breakpoint
CREATE UNIQUE INDEX "certificats_medicaux_documents_patient_id_unique" ON "certificats_medicaux" USING btree ("documents_patient_id");--> statement-breakpoint
CREATE INDEX "certificats_medicaux_documents_patient_id_idx" ON "certificats_medicaux" USING btree ("documents_patient_id");--> statement-breakpoint
CREATE INDEX "certificats_medicaux_utilisateur_id_idx" ON "certificats_medicaux" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "certificats_medicaux_suivi_id_idx" ON "certificats_medicaux" USING btree ("suivi_id");--> statement-breakpoint
CREATE INDEX "documents_patient_patient_id_idx" ON "documents_patient" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "documents_patient_categorie_id_idx" ON "documents_patient" USING btree ("categorie_id");--> statement-breakpoint
CREATE INDEX "documents_patient_uploade_par_utilisateur_idx" ON "documents_patient" USING btree ("uploade_par_utilisateur");--> statement-breakpoint
CREATE INDEX "examen_consultation_rendez_vous_id_idx" ON "examen_consultation" USING btree ("rendez_vous_id");--> statement-breakpoint
CREATE INDEX "examen_consultation_suivi_id_idx" ON "examen_consultation" USING btree ("suivi_id");--> statement-breakpoint
CREATE INDEX "historique_traitements_patient_id_idx" ON "historique_traitements" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "historique_traitements_medicament_id_idx" ON "historique_traitements" USING btree ("medicament_id");--> statement-breakpoint
CREATE INDEX "historique_traitements_prescrit_par_utilisateur_idx" ON "historique_traitements" USING btree ("prescrit_par_utilisateur");--> statement-breakpoint
CREATE UNIQUE INDEX "lettres_orientation_documents_patient_id_unique" ON "lettres_orientation" USING btree ("documents_patient_id");--> statement-breakpoint
CREATE INDEX "lettres_orientation_documents_patient_id_idx" ON "lettres_orientation" USING btree ("documents_patient_id");--> statement-breakpoint
CREATE INDEX "lettres_orientation_utilisateur_id_idx" ON "lettres_orientation" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "lettres_orientation_suivi_id_idx" ON "lettres_orientation" USING btree ("suivi_id");--> statement-breakpoint
CREATE INDEX "logs_utilisateur_id_idx" ON "logs" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "ordonnance_rendez_vous_id_idx" ON "ordonnance" USING btree ("rendez_vous_id");--> statement-breakpoint
CREATE INDEX "ordonnance_patient_id_idx" ON "ordonnance" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "ordonnance_utilisateur_id_idx" ON "ordonnance" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "ordonnance_medicaments_ordonnance_id_idx" ON "ordonnance_medicaments" USING btree ("ordonnance_id");--> statement-breakpoint
CREATE INDEX "ordonnance_medicaments_medicament_id_idx" ON "ordonnance_medicaments" USING btree ("medicament_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_matricule_unique" ON "patients" USING btree ("matricule");--> statement-breakpoint
CREATE INDEX "patients_cree_par_utilisateur_idx" ON "patients" USING btree ("cree_par_utilisateur");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_femmes_patient_id_unique" ON "patients_femmes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "patients_femmes_patient_id_idx" ON "patients_femmes" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "rendez_vous_patient_id_idx" ON "rendez_vous" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "rendez_vous_suivi_id_idx" ON "rendez_vous" USING btree ("suivi_id");--> statement-breakpoint
CREATE INDEX "rendez_vous_utilisateur_id_idx" ON "rendez_vous" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "sessions_utilisateur_id_idx" ON "sessions" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE INDEX "suivi_patient_id_idx" ON "suivi" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "suivi_utilisateur_id_idx" ON "suivi" USING btree ("utilisateur_id");--> statement-breakpoint
CREATE UNIQUE INDEX "utilisateurs_email_unique" ON "utilisateurs" USING btree ("email");--> statement-breakpoint
CREATE INDEX "vaccinations_patient_patient_id_idx" ON "vaccinations_patient" USING btree ("patient_id");--> statement-breakpoint
CREATE INDEX "voyages_recents_patient_id_idx" ON "voyages_recents" USING btree ("patient_id");