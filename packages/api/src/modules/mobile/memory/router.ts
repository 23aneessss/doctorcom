import { z } from "zod";

import { createTRPCRouter, protectedProcedure } from "../../../trpc/init";
import { mobileMemoryService } from "./service";

const uuidSchema = z.string().uuid();

export const mobileMemoryRouter = createTRPCRouter({
  getNotes: protectedProcedure
    .input(
      z
        .object({
          search: z.string().trim().optional(),
          tags: z.array(z.string().trim().min(1)).optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        })
        .default({
          limit: 50,
          offset: 0,
        }),
    )
    .query(async ({ ctx, input }) => {
      return mobileMemoryService.getNotes({
        db: ctx.db,
        session: ctx.session,
        search: input.search,
        tags: input.tags,
        limit: input.limit,
        offset: input.offset,
      });
    }),
  getNote: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .query(async ({ ctx, input }) => {
      return mobileMemoryService.getNote({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
      });
    }),
  createNote: protectedProcedure
    .input(
      z.object({
        title: z.string().trim().optional(),
        content: z.string().trim().min(1),
        tags: z.array(z.string().trim().min(1)).default([]),
        isPinned: z.boolean().optional(),
        color: z.string().trim().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return mobileMemoryService.createNote({
        db: ctx.db,
        session: ctx.session,
        input,
      });
    }),
  updateNote: protectedProcedure
    .input(
      z.object({
        id: uuidSchema,
        title: z.string().trim().optional(),
        content: z.string().trim().min(1).optional(),
        tags: z.array(z.string().trim().min(1)).optional(),
        isPinned: z.boolean().optional(),
        color: z.string().trim().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...changes } = input;
      return mobileMemoryService.updateNote({
        db: ctx.db,
        session: ctx.session,
        id,
        input: changes,
      });
    }),
  deleteNote: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return mobileMemoryService.deleteNote({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
      });
    }),
  togglePin: protectedProcedure
    .input(z.object({ id: uuidSchema }))
    .mutation(async ({ ctx, input }) => {
      return mobileMemoryService.togglePin({
        db: ctx.db,
        session: ctx.session,
        id: input.id,
      });
    }),
  getTags: protectedProcedure.query(async ({ ctx }) => {
    return mobileMemoryService.getTags({
      db: ctx.db,
      session: ctx.session,
    });
  }),
});
