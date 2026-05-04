import express, { Router } from "express";
import { auth } from "@doctor.com/auth";
import { db } from "@doctor.com/db";
import { patients, utilisateurs } from "@doctor.com/db/schema";
import { documentsService } from "@doctor.com/api/modules/documents/service";
import { ordonnanceService } from "@doctor.com/api/modules/ordonnance/service";
import {
  buildPatientDocumentObjectName,
  buildPatientStorageSlug,
  getObjectNameFromUrl,
  isStorageUnavailableError,
  minioClient,
  storageConfig,
  uploadFile,
} from "@doctor.com/api/infrastructure/storage";
import { toSimpleFrenchRuntimeMessage } from "@doctor.com/api/trpc/error-messages";
import { fromNodeHeaders } from "better-auth/node";
import { eq } from "drizzle-orm";
import multer from "multer";
import { isStorageAvailable } from "../infrastructure/storage-state";

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
    res.status(401).json({ error: "La session a expiré. Reconnectez-vous." });
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
      error: "Le compte associé à cette session est introuvable.",
    });
    return null;
  }

  return utilisateur.id;
}

function ensureStorageReady(res: express.Response): boolean {
  if (isStorageAvailable()) {
    return true;
  }

  res.status(503).json({
    error:
      "Le stockage des documents est temporairement indisponible. Reessayez dans quelques instants.",
  });
  return false;
}

function getDocumentDownloadName(documentName: string, objectName: string): string {
  if (/\.[a-z0-9]{2,8}$/i.test(documentName)) {
    return documentName;
  }

  const objectFilename = objectName.split("/").pop() ?? "";
  const extension = objectFilename.match(/\.[a-z0-9]{2,8}$/i)?.[0] ?? "";
  return `${documentName || "document"}${extension}`;
}

function buildContentDisposition(filename: string, download: boolean): string {
  const fallbackName = filename.replace(/[^\w.-]+/g, "_") || "document";
  return `${download ? "attachment" : "inline"}; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function isPdfUpload(file: Express.Multer.File): boolean {
  return file.buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

async function resolveDefaultDocumentCategorieId(): Promise<string> {
  const categories = await documentsService.getToutesCategories({ db });
  const defaultCategory =
    categories.find(
      (category) =>
        category.nom.trim().toLowerCase() === "documents patient",
    ) ?? categories[0];

  if (defaultCategory) {
    return defaultCategory.id;
  }

  const created = await documentsService.creerCategorie({
    db,
    input: {
      nom: "Documents patient",
      description: "Documents importes dans le dossier patient.",
    },
  });

  return created.id;
}

router.post("/ordonnance-template", upload.single("file"), async (req, res) => {
  try {
    if (!ensureStorageReady(res)) return;

    const session = await requireSession(req, res);
    if (!session) return;

    const utilisateurId = await requireUtilisateurId(session.user.email, res);
    if (!utilisateurId) return;

    if (!req.file) {
      res.status(400).json({ error: "Aucun fichier fourni." });
      return;
    }

    if (!isPdfUpload(req.file)) {
      res.status(400).json({
        error:
          "Le fichier importe n'est pas un PDF valide. Exportez votre template en PDF puis reessayez.",
      });
      return;
    }

    const body = JSON.parse(req.body.json ?? "{}");
    const originalName = req.file.originalname.replace(/\.pdf$/i, "").trim();
    const nom =
      typeof body.nom === "string" && body.nom.trim()
        ? body.nom.trim()
        : originalName || "Template ordonnance";
    const description =
      typeof body.description === "string" ? body.description.trim() : null;

    const uploaded = await uploadFile({
      file: req.file,
      folder: "ordonnance-templates",
    });

    const template = await ordonnanceService.creerPdfTemplateFromUpload({
      db,
      session,
      input: {
        nom,
        description,
        chemin_fichier: uploaded.url,
        type_fichier: uploaded.mimeType || "application/pdf",
        taille_fichier: uploaded.size,
      },
    });

    res.status(201).json(template);
  } catch (err: any) {
    console.error("Upload ordonnance template error:", err);
    res.status(500).json({
      error: toSimpleFrenchRuntimeMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: err?.message,
      }),
    });
  }
});

router.get("/ordonnance-template/:id/file", async (req, res) => {
  try {
    if (!ensureStorageReady(res)) return;

    const session = await requireSession(req, res);
    if (!session) return;

    const template = await ordonnanceService.getPdfTemplate({
      db,
      session,
      id: req.params.id,
    });
    const objectName = getObjectNameFromUrl(template.chemin_fichier);
    const filename = getDocumentDownloadName(`${template.nom}.pdf`, objectName);
    const download = req.query.download === "1" || req.query.download === "true";
    const stream = await minioClient.getObject(storageConfig.bucket, objectName);

    res.setHeader("Content-Type", template.type_fichier || "application/pdf");
    res.setHeader("Content-Length", template.taille_fichier.toString());
    res.setHeader("Content-Disposition", buildContentDisposition(filename, download));

    stream.on("error", (error) => {
      console.error("Ordonnance template stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Le fichier n'a pas pu etre lu." });
      } else {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  } catch (err: any) {
    console.error("Read ordonnance template file error:", err);
    if (isStorageUnavailableError(err)) {
      res.status(503).json({
        error:
          "Le stockage des documents est temporairement indisponible. Reessayez dans quelques instants.",
      });
      return;
    }

    res.status(err?.code === "NoSuchKey" ? 404 : 500).json({
      error:
        err?.code === "NoSuchKey"
          ? "Le fichier associe a ce template est introuvable."
          : toSimpleFrenchRuntimeMessage({
              code: "INTERNAL_SERVER_ERROR",
              message: err?.message,
            }),
    });
  }
});

async function resolvePatientStorageInfo(patientId: string) {
  const [patient] = await db
    .select({
      id: patients.id,
      nom: patients.nom,
      prenom: patients.prenom,
      matricule: patients.matricule,
    })
    .from(patients)
    .where(eq(patients.id, patientId))
    .limit(1);

  if (!patient) {
    throw new Error("Patient introuvable.");
  }

  return {
    ...patient,
    storageSlug: buildPatientStorageSlug(patient),
  };
}

async function uploadPatientDocumentFile(params: {
  file: Express.Multer.File;
  patientId: string;
  typeDocument: string;
}) {
  const patient = await resolvePatientStorageInfo(params.patientId);
  return uploadFile({
    file: params.file,
    objectName: buildPatientDocumentObjectName({
      patientSlug: patient.storageSlug,
      documentType: params.typeDocument,
      originalName: params.file.originalname,
    }),
  });
}

router.post("/document", upload.single("file"), async (req, res) => {
  try {
    if (!ensureStorageReady(res)) return;

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

    if (!patient_id || !nom_document || !type_document) {
      res.status(400).json({
        error:
          "Champs obligatoires manquants: patient_id, nom_document, type_document.",
      });
      return;
    }

    const resolvedCategorieId = categorie_id ?? (await resolveDefaultDocumentCategorieId());
    const uploaded = await uploadPatientDocumentFile({
      file: req.file,
      patientId: patient_id,
      typeDocument: type_document,
    });

    const document = await documentsService.creerDocument({
      db,
      input: {
        patient_id,
        categorie_id: resolvedCategorieId,
        nom_document,
        type_document,
        chemin_fichier: uploaded.url,
        type_fichier: uploaded.mimeType,
        taille_fichier: uploaded.size,
        description: description ?? null,
      },
      userEmail: session.user.email,
    });

    res.status(201).json(document);
  } catch (err: any) {
    console.error("Upload document error:", err);
    res.status(500).json({
      error: toSimpleFrenchRuntimeMessage({
        code: "INTERNAL_SERVER_ERROR",
        message: err?.message,
      }),
    });
  }
});

router.get("/document/:id/file", async (req, res) => {
  try {
    if (!ensureStorageReady(res)) return;

    const session = await requireSession(req, res);
    if (!session) return;

    const document = await documentsService.getDocumentById({
      db,
      id: req.params.id,
    });
    const objectName = getObjectNameFromUrl(document.chemin_fichier);
    const filename = getDocumentDownloadName(document.nom_document, objectName);
    const download = req.query.download === "1" || req.query.download === "true";
    const stream = await minioClient.getObject(storageConfig.bucket, objectName);

    res.setHeader("Content-Type", document.type_fichier || "application/octet-stream");
    res.setHeader("Content-Length", document.taille_fichier.toString());
    res.setHeader("Content-Disposition", buildContentDisposition(filename, download));

    stream.on("error", (error) => {
      console.error("Document stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Le fichier n'a pas pu etre lu." });
      } else {
        res.destroy(error);
      }
    });

    stream.pipe(res);
  } catch (err: any) {
    console.error("Read document file error:", err);
    if (isStorageUnavailableError(err)) {
      res.status(503).json({
        error:
          "Le stockage des documents est temporairement indisponible. Reessayez dans quelques instants.",
      });
      return;
    }

    res.status(err?.code === "NoSuchKey" ? 404 : 500).json({
      error:
        err?.code === "NoSuchKey"
          ? "Le fichier associe a ce document est introuvable."
          : toSimpleFrenchRuntimeMessage({
              code: "INTERNAL_SERVER_ERROR",
              message: err?.message,
            }),
    });
  }
});

export const uploadRouter: Router = router;
