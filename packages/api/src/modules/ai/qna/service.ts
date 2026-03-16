import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { createMistral } from "@ai-sdk/mistral";
import type { db as databaseClient } from "@doctor.com/db";
import { env } from "@doctor.com/env/server";

import type { SessionUtilisateur } from "../../../trpc/context";
import { aiRepository, type FullPatientData } from "./repo";
import { utilisateurs } from "@doctor.com/db/schema";
import { eq } from "drizzle-orm";

type DatabaseClient = typeof databaseClient;
type AiSession = Exclude<SessionUtilisateur, null>;

export class AiService {
  async ask(data: {
    db: DatabaseClient;
    session: AiSession;
    patient_id: string;
    question: string;
  }): Promise<{ answer: string }> {
    // Check API key is available
    if (!env.MISTRAL_API_KEY) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message:
          "MISTRAL_API_KEY n'est pas configuree. Veuillez ajouter la cle API dans les variables d'environnement.",
      });
    }

    // Resolve authenticated utilisateur
    await this.resolveUtilisateur(data.db, data.session);

    // Fetch full patient data
    const patientData = await aiRepository.getFullPatientData(data.db, data.patient_id);

    if (!patientData) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Patient introuvable.",
      });
    }

    // Build the structured patient context
    const patientContext = this.buildPatientPrompt(patientData);

    // Call Mistral via Vercel AI SDK
    const mistral = createMistral({
      apiKey: env.MISTRAL_API_KEY,
    });

    const result = await generateText({
      model: mistral("mistral-large-latest"),
      system:
        "Vous etes un assistant medical destine aux medecins. Regles strictes :\n\n1. Repondez UNIQUEMENT a la question posee — ne mentionnez pas d'informations provenant d'autres sections des donnees qui ne sont pas directement liees a la question.\n2. Basez-vous exclusivement sur les donnees du patient fournies ci-dessous.\n3. Soyez bref et direct : quelques lignes suffisent pour une question factuelle simple. N'ajoutez pas de recapitulatif, de contexte supplementaire ou de sections non demandees.\n4. Ne speculez pas sur les donnees manquantes. Mentionnez l'absence d'information UNIQUEMENT si la question porte specifiquement sur une donnee absente.\n5. Repondez en francais. Utilisez le Markdown (listes, gras) uniquement si cela ameliore la lisibilite — pas de titres inutiles pour les reponses courtes.",
      prompt: `## Donnees du patient\n\n${patientContext}\n\n## Question du medecin\n\n${data.question}`,
    });

    return { answer: result.text };
  }

  private buildPatientPrompt(data: FullPatientData): string {
    const sections: string[] = [];

    // --- Informations du patient ---
    const p = data.patient;
    const infoLines = [
      `Nom: ${p.nom} ${p.prenom}`,
      `Date de naissance: ${p.date_naissance}`,
      `Sexe: ${p.sexe ?? "Non renseigne"}`,
      `Groupe sanguin: ${p.groupe_sanguin ?? "Non renseigne"}`,
      `Profession: ${p.profession ?? "Non renseignee"}`,
      `Situation familiale: ${p.situation_familiale ?? "Non renseignee"}`,
      `Nombre d'enfants: ${p.nb_enfants ?? "Non renseigne"}`,
    ];

    if (p.habitudes_saines) {
      infoLines.push(`Habitudes saines: ${p.habitudes_saines}`);
    }
    if (p.habitudes_toxiques) {
      infoLines.push(`Habitudes toxiques: ${p.habitudes_toxiques}`);
    }
    if (p.environnement_animal) {
      infoLines.push(`Environnement animal: ${p.environnement_animal}`);
    }

    sections.push(`## Informations du patient\n${infoLines.join("\n")}`);

    // --- Donnees specifiques femme ---
    if (data.donnees_femme) {
      const f = data.donnees_femme;
      const femmeLines: string[] = [];
      if (f.menarche) femmeLines.push(`Menarche: ${f.menarche} ans`);
      if (f.regularite_cycles) femmeLines.push(`Cycles: ${f.regularite_cycles}`);
      if (f.contraception) femmeLines.push(`Contraception: ${f.contraception}`);
      if (f.nb_grossesses != null) femmeLines.push(`Grossesses: ${f.nb_grossesses}`);
      if (f.nb_cesariennes != null) femmeLines.push(`Cesariennes: ${f.nb_cesariennes}`);
      if (f.menopause != null)
        femmeLines.push(`Menopause: ${f.menopause ? "Oui" : "Non"}`);
      if (f.age_menopause) femmeLines.push(`Age menopause: ${f.age_menopause} ans`);
      if (f.symptomes_menopause)
        femmeLines.push(`Symptomes menopause: ${f.symptomes_menopause}`);

      if (femmeLines.length > 0) {
        sections.push(`## Donnees gynecologiques\n${femmeLines.join("\n")}`);
      }
    }

    // --- Voyages recents ---
    if (data.voyages.length > 0) {
      const voyageLines = data.voyages.map((v) => {
        let line = `- ${v.destination}, ${v.date}`;
        if (v.duree_jours) line += `, ${v.duree_jours} jours`;
        if (v.epidemies_destination) line += ` (${v.epidemies_destination})`;
        return line;
      });
      sections.push(`## Voyages recents\n${voyageLines.join("\n")}`);
    }

    // --- Antecedents personnels ---
    const antPersonnels = data.antecedents.filter((a) => a.type === "personnel");
    if (antPersonnels.length > 0) {
      const lines: string[] = [];
      for (const ant of antPersonnels) {
        lines.push(`- ${ant.description}`);
        for (const ap of ant.personnels) {
          lines.push(
            `  Type: ${ap.type}, Actif: ${ap.est_actif ? "Oui" : "Non"}${ap.details ? `, Details: ${ap.details}` : ""}`,
          );
        }
      }
      sections.push(`## Antecedents personnels\n${lines.join("\n")}`);
    }

    // --- Antecedents familiaux ---
    const antFamiliaux = data.antecedents.filter((a) => a.type === "familial");
    if (antFamiliaux.length > 0) {
      const lines: string[] = [];
      for (const ant of antFamiliaux) {
        lines.push(`- ${ant.description}`);
        for (const af of ant.familiaux) {
          lines.push(
            `  Lien: ${af.lien_parente ?? "Non precise"}${af.details ? `, ${af.details}` : ""}`,
          );
        }
      }
      sections.push(`## Antecedents familiaux\n${lines.join("\n")}`);
    }

    // --- Suivi medical ---
    if (data.suivis.length > 0) {
      const lines = data.suivis.map((s) => {
        const status = s.est_actif ? "Actif" : `Cloture le ${s.date_fermeture ?? "N/A"}`;
        let line = `- Motif: ${s.motif} (${status}, ouvert le ${s.date_ouverture})`;
        if (s.hypothese_diagnostic) line += `\n  Hypothese: ${s.hypothese_diagnostic}`;
        if (s.historique) line += `\n  Historique: ${s.historique}`;
        return line;
      });
      sections.push(`## Suivi medical\n${lines.join("\n")}`);
    }

    // --- Rendez-vous ---
    if (data.rendez_vous.length > 0) {
      const lines = data.rendez_vous.map(
        (r) =>
          `- ${r.date} a ${r.heure}, Statut: ${r.statut}${r.important ? " (IMPORTANT)" : ""}`,
      );
      sections.push(`## Rendez-vous\n${lines.join("\n")}`);
    }

    // --- Consultations (examens) ---
    if (data.examens.length > 0) {
      const lines: string[] = [];
      for (const e of data.examens) {
        lines.push(`### Consultation du ${e.date}`);
        if (e.taille) lines.push(`Taille: ${e.taille} cm`);
        if (e.poids) lines.push(`Poids: ${e.poids} kg`);
        if (e.description_consultation) lines.push(`Description: ${e.description_consultation}`);
        if (e.aspect_general) lines.push(`Aspect general: ${e.aspect_general}`);
        if (e.examen_respiratoire) lines.push(`Examen respiratoire: ${e.examen_respiratoire}`);
        if (e.examen_cardiovasculaire)
          lines.push(`Examen cardiovasculaire: ${e.examen_cardiovasculaire}`);
        if (e.examen_cutane_muqueux)
          lines.push(`Examen cutane-muqueux: ${e.examen_cutane_muqueux}`);
        if (e.examen_orl) lines.push(`Examen ORL: ${e.examen_orl}`);
        if (e.examen_digestif) lines.push(`Examen digestif: ${e.examen_digestif}`);
        if (e.examen_neurologique) lines.push(`Examen neurologique: ${e.examen_neurologique}`);
        if (e.examen_locomoteur) lines.push(`Examen locomoteur: ${e.examen_locomoteur}`);
        if (e.examen_genital) lines.push(`Examen genital: ${e.examen_genital}`);
        if (e.examen_urinaire) lines.push(`Examen urinaire: ${e.examen_urinaire}`);
        if (e.examen_ganglionnaire) lines.push(`Examen ganglionnaire: ${e.examen_ganglionnaire}`);
        if (e.examen_endocrinien) lines.push(`Examen endocrinien: ${e.examen_endocrinien}`);
        if (e.traitement_prescrit) lines.push(`Traitement prescrit: ${e.traitement_prescrit}`);
        if (e.conclusion) lines.push(`Conclusion: ${e.conclusion}`);
      }
      sections.push(`## Consultations\n${lines.join("\n")}`);
    }

    // --- Traitements en cours ---
    if (data.traitements.length > 0) {
      const lines = data.traitements.map((t) => {
        const medName = t.nom_medicament ?? "Medicament inconnu";
        const status = t.est_actif ? "En cours" : "Termine";
        return `- ${medName}: ${t.posologie} (${status}, prescrit le ${t.date_prescription})`;
      });
      sections.push(`## Traitements\n${lines.join("\n")}`);
    }

    // --- Ordonnances ---
    if (data.ordonnances.length > 0) {
      const lines: string[] = [];
      for (const ord of data.ordonnances) {
        lines.push(`### Ordonnance du ${ord.date_prescription}`);
        if (ord.remarques) lines.push(`Remarques: ${ord.remarques}`);
        for (const om of ord.medicaments) {
          const medName = om.dci ?? om.nom_medicament ?? "Medicament inconnu";
          lines.push(`- ${medName}: ${om.posologie}`);
          if (om.duree_traitement) lines.push(`  Duree: ${om.duree_traitement}`);
          if (om.instructions) lines.push(`  Instructions: ${om.instructions}`);
        }
      }
      sections.push(`## Ordonnances\n${lines.join("\n")}`);
    }

    // --- Vaccinations ---
    if (data.vaccinations.length > 0) {
      const lines = data.vaccinations.map((v) => {
        let line = `- ${v.vaccin}, ${v.date_vaccination}`;
        if (v.notes) line += ` (${v.notes})`;
        return line;
      });
      sections.push(`## Vaccinations\n${lines.join("\n")}`);
    }

    // --- Certificats medicaux ---
    if (data.certificats.length > 0) {
      const lines = data.certificats.map((c) => {
        let line = `- Type: ${c.type_certificat}, Statut: ${c.statut}, Emis le ${c.date_emission}`;
        if (c.diagnostic) line += `\n  Diagnostic: ${c.diagnostic}`;
        if (c.destinataire) line += `\n  Destinataire: ${c.destinataire}`;
        return line;
      });
      sections.push(`## Certificats medicaux\n${lines.join("\n")}`);
    }

    // --- Lettres d'orientation ---
    if (data.lettres_orientation.length > 0) {
      const lines = data.lettres_orientation.map((l) => {
        const linesArr = [
          `- Urgence: ${l.urgence}, Destinataire: ${l.destinataire ?? "Non precise"}`,
        ];
        if (l.raison) linesArr.push(`  Raison: ${l.raison}`);
        if (l.examen_demande) linesArr.push(`  Examen demande: ${l.examen_demande}`);
        return linesArr.join("\n");
      });
      sections.push(`## Lettres d'orientation\n${lines.join("\n")}`);
    }

    return sections.join("\n\n");
  }

  private resolveSessionEmail(session: AiSession): string {
    const email = session.user.email.trim().toLowerCase();
    if (!email) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Session invalide: email utilisateur manquant.",
      });
    }
    return email;
  }

  private async resolveUtilisateur(
    database: DatabaseClient,
    session: AiSession,
  ) {
    const email = this.resolveSessionEmail(session);
    const [utilisateur] = await database
      .select()
      .from(utilisateurs)
      .where(eq(utilisateurs.email, email))
      .limit(1);

    if (!utilisateur) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Utilisateur connecte introuvable.",
      });
    }

    return utilisateur;
  }
}

export const aiService = new AiService();
