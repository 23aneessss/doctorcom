import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { documentsService } from "./service";

const uuidSchema = z.string().uuid();
const isoDateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide. Format attendu: YYYY-MM-DD.");

const urgenceSchema = z.enum(["normale", "urgente", "tres_urgente"]);
const typeCertificatSchema = z.enum([
	"arret_travail",
	"aptitude",
	"scolaire",
	"grossesse",
	"deces",
]);
const statutCertificatSchema = z.enum(["brouillon", "emis", "annule"]);

const categorieInputSchema = z.object({
	nom: z.string().trim().min(1),
	description: z.string().trim().optional().nullable(),
});

const documentBaseInputSchema = z.object({
	patient_id: uuidSchema,
	categorie_id: uuidSchema,
	type_document: z.string().trim().min(1).max(128),
	nom_document: z.string().trim().min(1).max(255),
	chemin_fichier: z.string().min(1),
	type_fichier: z.string().trim().min(1).max(64),
	taille_fichier: z.number().int().nonnegative(),
	description: z.string().optional().nullable(),
});

const updateDocumentInputSchema = z
	.object({
		categorie_id: uuidSchema.optional(),
		type_document: z.string().trim().min(1).max(128).optional(),
		nom_document: z.string().trim().min(1).max(255).optional(),
		chemin_fichier: z.string().min(1).optional(),
		type_fichier: z.string().trim().min(1).max(64).optional(),
		taille_fichier: z.number().int().nonnegative().optional(),
		description: z.string().optional().nullable(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Au moins un champ doit etre fourni.",
	});

const lettreInputSchema = z.object({
	suivi_id: uuidSchema,
	type_exploration: z.string().trim().max(255).optional().nullable(),
	examen_demande: z.string().optional().nullable(),
	raison: z.string().optional().nullable(),
	destinataire: z.string().trim().max(255).optional().nullable(),
	urgence: urgenceSchema,
	contenu_lettre: z.string().optional().nullable(),
});

const updateLettreInputSchema = z
	.object({
		type_exploration: z.string().trim().max(255).optional().nullable(),
		examen_demande: z.string().optional().nullable(),
		raison: z.string().optional().nullable(),
		destinataire: z.string().trim().max(255).optional().nullable(),
		urgence: urgenceSchema.optional(),
		contenu_lettre: z.string().optional().nullable(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Au moins un champ doit etre fourni.",
	});

const certificatInputSchema = z.object({
	suivi_id: uuidSchema,
	type_certificat: typeCertificatSchema,
	date_emission: isoDateSchema,
	date_debut: isoDateSchema.optional().nullable(),
	date_fin: isoDateSchema.optional().nullable(),
	diagnostic: z.string().optional().nullable(),
	destinataire: z.string().trim().max(255).optional().nullable(),
	notes: z.string().optional().nullable(),
	statut: statutCertificatSchema,
});

const updateCertificatInputSchema = z
	.object({
		type_certificat: typeCertificatSchema.optional(),
		date_emission: isoDateSchema.optional(),
		date_debut: isoDateSchema.optional().nullable(),
		date_fin: isoDateSchema.optional().nullable(),
		diagnostic: z.string().optional().nullable(),
		destinataire: z.string().trim().max(255).optional().nullable(),
		notes: z.string().optional().nullable(),
		statut: statutCertificatSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Au moins un champ doit etre fourni.",
	});

export const documentsRouter = createTRPCRouter({
	creerCategorie: protectedProcedure
		.input(categorieInputSchema)
		.mutation(async ({ ctx, input }) => {
			return documentsService.creerCategorie({
				db: ctx.db,
				input,
			});
		}),

	mettreAJourCategorie: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
				data: categorieInputSchema.partial().refine((value) => Object.keys(value).length > 0, {
					message: "Au moins un champ doit etre fourni.",
				}),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.mettreAJourCategorie({
				db: ctx.db,
				id: input.id,
				input: input.data,
			});
		}),

	supprimerCategorie: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.supprimerCategorie({
				db: ctx.db,
				id: input.id,
			});
		}),

	getToutesCategories: protectedProcedure.query(async ({ ctx }) => {
		return documentsService.getToutesCategories({ db: ctx.db });
	}),

	creerDocument: protectedProcedure
		.input(documentBaseInputSchema)
		.mutation(async ({ ctx, input }) => {
			return documentsService.creerDocument({
				db: ctx.db,
				input,
				userId: ctx.session.user.id,
			});
		}),

	mettreAJourDocument: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
				data: updateDocumentInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.mettreAJourDocument({
				db: ctx.db,
				id: input.id,
				input: input.data,
			});
		}),

	supprimerDocument: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.supprimerDocument({
				db: ctx.db,
				id: input.id,
			});
		}),

	archiverDocument: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.archiverDocument({
				db: ctx.db,
				id: input.id,
			});
		}),

	restaurerDocument: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.restaurerDocument({
				db: ctx.db,
				id: input.id,
			});
		}),

	getDocument: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getDocumentById({
				db: ctx.db,
				id: input.id,
			});
		}),

	getDocumentsByPatient: protectedProcedure
		.input(z.object({ patientId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getDocumentsByPatient({
				db: ctx.db,
				patientId: input.patientId,
			});
		}),

	getDocumentsByType: protectedProcedure
		.input(
			z.object({
				patientId: uuidSchema,
				typeDocument: z.string().trim().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			return documentsService.getDocumentsByType({
				db: ctx.db,
				patientId: input.patientId,
				typeDocument: input.typeDocument,
			});
		}),

	creerLettre: protectedProcedure
		.input(
			z.object({
				document: documentBaseInputSchema,
				lettre: lettreInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.creerLettre({
				db: ctx.db,
				input,
				userId: ctx.session.user.id,
			});
		}),

	mettreAJourLettre: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
				data: updateLettreInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.mettreAJourLettre({
				db: ctx.db,
				id: input.id,
				input: input.data,
				userId: ctx.session.user.id,
			});
		}),

	supprimerLettre: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.supprimerLettre({
				db: ctx.db,
				id: input.id,
			});
		}),

	getLettre: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getLettreById({
				db: ctx.db,
				id: input.id,
			});
		}),

	getLettresByPatient: protectedProcedure
		.input(z.object({ patientId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getLettresByPatient({
				db: ctx.db,
				patientId: input.patientId,
			});
		}),

	getLettresBySuivi: protectedProcedure
		.input(z.object({ suiviId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getLettresBySuivi({
				db: ctx.db,
				suiviId: input.suiviId,
			});
		}),

	creerCertificat: protectedProcedure
		.input(
			z.object({
				document: documentBaseInputSchema,
				certificat: certificatInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.creerCertificat({
				db: ctx.db,
				input,
				userId: ctx.session.user.id,
			});
		}),

	mettreAJourCertificat: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
				data: updateCertificatInputSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return documentsService.mettreAJourCertificat({
				db: ctx.db,
				id: input.id,
				input: input.data,
				userId: ctx.session.user.id,
			});
		}),

	supprimerCertificat: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.mutation(async ({ ctx, input }) => {
			return documentsService.supprimerCertificat({
				db: ctx.db,
				id: input.id,
			});
		}),

	getCertificat: protectedProcedure
		.input(z.object({ id: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getCertificatById({
				db: ctx.db,
				id: input.id,
			});
		}),

	getCertificatsByPatient: protectedProcedure
		.input(z.object({ patientId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getCertificatsByPatient({
				db: ctx.db,
				patientId: input.patientId,
			});
		}),

	getCertificatsBySuivi: protectedProcedure
		.input(z.object({ suiviId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getCertificatsBySuivi({
				db: ctx.db,
				suiviId: input.suiviId,
			});
		}),

	getCertificatsByType: protectedProcedure
		.input(
			z.object({
				patientId: uuidSchema,
				typeCertificat: typeCertificatSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return documentsService.getCertificatsByType({
				db: ctx.db,
				patientId: input.patientId,
				typeCertificat: input.typeCertificat,
			});
		}),

	getCertificatsActifs: protectedProcedure
		.input(z.object({ patientId: uuidSchema }))
		.query(async ({ ctx, input }) => {
			return documentsService.getCertificatsActifs({
				db: ctx.db,
				patientId: input.patientId,
			});
		}),
});
