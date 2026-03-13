import { z } from "zod";

import { createPatientSchema, updatePatientSchema, uuidSchema } from "@doctor.com/shared/schemas";

import { createTRPCRouter, protectedProcedure } from "../../trpc/init";
import { patientService } from "./service";

const femalePatientInfoSchema = z
	.object({
		menarche: z.number().int().min(0).nullable().optional(),
		regularite_cycles: z.string().trim().min(1).max(255).nullable().optional(),
		contraception: z.string().trim().min(1).nullable().optional(),
		nb_grossesses: z.number().int().min(0).nullable().optional(),
		nb_cesariennes: z.number().int().min(0).nullable().optional(),
		menopause: z.boolean().nullable().optional(),
		age_menopause: z.number().int().min(0).nullable().optional(),
		symptomes_menopause: z.string().trim().min(1).nullable().optional(),
	})
	.strict();

const createPatientInputSchema = z.object({
	patient: createPatientSchema.omit({ cree_par_utilisateur: true }),
	female_data: femalePatientInfoSchema.optional(),
});

const updatePatientDataSchema = updatePatientSchema
	.omit({ id: true, cree_par_utilisateur: true })
	.extend({
		female_data: femalePatientInfoSchema.optional(),
	})
	.refine((value) => Object.keys(value).length > 0, {
		message: "Au moins un champ doit etre fourni pour mettre a jour le patient.",
	});

const searchPatientsInputSchema = z.object({
	nom: z.string().trim().min(1).optional(),
	prenom: z.string().trim().min(1).optional(),
	matricule: z.string().trim().min(1).optional(),
	NSS: z.union([z.number().int().min(0), z.string().trim().regex(/^\d+$/)]).optional(),
	telephone: z.string().trim().min(1).optional(),
	sexe: z.string().trim().min(1).optional(),
});

export const patientRouter = createTRPCRouter({
	createPatient: protectedProcedure
		.input(createPatientInputSchema)
		.mutation(async ({ ctx, input }) => {
			return patientService.createPatient({
				db: ctx.db,
				session: ctx.session,
				input,
			});
		}),
	updatePatient: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
				data: updatePatientDataSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return patientService.updatePatient({
				db: ctx.db,
				session: ctx.session,
				input,
			});
		}),
	deletePatient: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.mutation(async ({ ctx, input }) => {
			return patientService.deletePatient({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatient: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientById({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatientByMatricule: protectedProcedure
		.input(
			z.object({
				matricule: z.string().trim().min(1),
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientByMatricule({
				db: ctx.db,
				session: ctx.session,
				matricule: input.matricule,
			});
		}),
	searchPatients: protectedProcedure
		.input(searchPatientsInputSchema)
		.query(async ({ ctx, input }) => {
			return patientService.searchPatients({
				db: ctx.db,
				session: ctx.session,
				criteres: {
					nom: input.nom,
					prenom: input.prenom,
					matricule: input.matricule,
					nss: input.NSS === undefined ? undefined : Number(input.NSS),
					telephone: input.telephone,
					sexe: input.sexe,
				},
			});
		}),
	getPatientFullRecord: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientFullRecord({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatientClinicalProfile: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientClinicalProfile({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatientAge: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientAge({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatientIMC: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientIMC({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
	getPatientUpcomingAppointments: protectedProcedure
		.input(
			z.object({
				id: uuidSchema,
			}),
		)
		.query(async ({ ctx, input }) => {
			return patientService.getPatientUpcomingAppointments({
				db: ctx.db,
				session: ctx.session,
				id: input.id,
			});
		}),
});