import express, { Router } from "express";
import { auth } from "@doctor.com/auth";
import { db } from "@doctor.com/db";
import { utilisateurs } from "@doctor.com/db/schema";
import { documentsService } from "@doctor.com/api/modules/documents/service";
import { uploadFile } from "@doctor.com/api/infrastructure/storage";
import { fromNodeHeaders } from "better-auth/node";
import multer from "multer";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function requireSession(req: express.Request, res: express.Response) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}

async function requireUtilisateurId(email: string, res: express.Response): Promise<string | null> {
  const utilisateursList = await db
    .select({ id: utilisateurs.id, email: utilisateurs.email })
    .from(utilisateurs)
    .limit(50);

  const utilisateur = utilisateursList.find((item) => item.email === email);

  if (!utilisateur) {
    res.status(400).json({
      error: "Utilisateur applicatif introuvable pour cette session.",
    });
    return null;
  }

  return utilisateur.id;
}

router.post("/document", upload.single("file"), async (req, res) => {
  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const utilisateurId = await requireUtilisateurId(session.user.email, res);
    if (!utilisateurId) return;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    const body = JSON.parse(req.body.json ?? "{}");
    const { patient_id, categorie_id, nom_document, type_document, description } = body;

    if (!patient_id || !categorie_id || !nom_document || !type_document) {
      res.status(400).json({
        error:
          "Champs obligatoires manquants: patient_id, categorie_id, nom_document, type_document.",
      });
      return;
    }

    const uploaded = await uploadFile({ file: req.file, folder: "documents" });

    const document = await documentsService.creerDocument({
      db,
      input: {
        patient_id,
        categorie_id,
        nom_document,
        type_document,
        chemin_fichier: uploaded.url,
        type_fichier: uploaded.mimeType,
        taille_fichier: uploaded.size,
        description: description ?? null,
      },
      userId: utilisateurId,
    });

    res.status(201).json(document);
  } catch (err: any) {
    console.error("Upload document error:", err);
    res.status(500).json({ error: err?.message ?? "Erreur interne." });
  }
});

router.post("/lettre", upload.single("file"), async (req, res) => {
  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const utilisateurId = await requireUtilisateurId(session.user.email, res);
    if (!utilisateurId) return;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    const body = JSON.parse(req.body.json ?? "{}");
    const {
      patient_id,
      categorie_id,
      nom_document,
      type_document,
      description,
      suivi_id,
      type_exploration,
      examen_demande,
      raison,
      destinataire,
      urgence,
      contenu_lettre,
    } = body;

    if (
      !patient_id ||
      !categorie_id ||
      !nom_document ||
      !type_document ||
      !suivi_id ||
      !urgence
    ) {
      res.status(400).json({
        error:
          "Champs obligatoires manquants: patient_id, categorie_id, nom_document, type_document, suivi_id, urgence.",
      });
      return;
    }

    const uploaded = await uploadFile({ file: req.file, folder: "documents" });

    const result = await documentsService.creerLettre({
      db,
      input: {
        document: {
          patient_id,
          categorie_id,
          nom_document,
          type_document,
          chemin_fichier: uploaded.url,
          type_fichier: uploaded.mimeType,
          taille_fichier: uploaded.size,
          description: description ?? null,
        },
        lettre: {
          suivi_id,
          type_exploration: type_exploration ?? null,
          examen_demande: examen_demande ?? null,
          raison: raison ?? null,
          destinataire: destinataire ?? null,
          urgence,
          contenu_lettre: contenu_lettre ?? null,
        },
      },
      userId: utilisateurId,
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error("Upload lettre error:", err);
    res.status(500).json({ error: err?.message ?? "Erreur interne." });
  }
});

router.post("/certificat", upload.single("file"), async (req, res) => {
  try {
    const session = await requireSession(req, res);
    if (!session) return;

    const utilisateurId = await requireUtilisateurId(session.user.email, res);
    if (!utilisateurId) return;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    const body = JSON.parse(req.body.json ?? "{}");
    const {
      patient_id,
      categorie_id,
      nom_document,
      type_document,
      description,
      suivi_id,
      type_certificat,
      date_emission,
      date_debut,
      date_fin,
      diagnostic,
      destinataire,
      notes,
      statut,
    } = body;

    if (
      !patient_id ||
      !categorie_id ||
      !nom_document ||
      !type_document ||
      !suivi_id ||
      !type_certificat ||
      !date_emission ||
      !statut
    ) {
      res.status(400).json({
        error:
          "Champs obligatoires manquants: patient_id, categorie_id, nom_document, type_document, suivi_id, type_certificat, date_emission, statut.",
      });
      return;
    }

    const uploaded = await uploadFile({ file: req.file, folder: "documents" });

    const result = await documentsService.creerCertificat({
      db,
      input: {
        document: {
          patient_id,
          categorie_id,
          nom_document,
          type_document,
          chemin_fichier: uploaded.url,
          type_fichier: uploaded.mimeType,
          taille_fichier: uploaded.size,
          description: description ?? null,
        },
        certificat: {
          suivi_id,
          type_certificat,
          date_emission,
          date_debut: date_debut ?? null,
          date_fin: date_fin ?? null,
          diagnostic: diagnostic ?? null,
          destinataire: destinataire ?? null,
          notes: notes ?? null,
          statut,
        },
      },
      userId: utilisateurId,
    });

    res.status(201).json(result);
  } catch (err: any) {
    console.error("Upload certificat error:", err);
    res.status(500).json({ error: err?.message ?? "Erreur interne." });
  }
});

export const uploadRouter: Router = router;