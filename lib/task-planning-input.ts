import { z } from 'zod';

export const planningContextInput = z.object({
  sort_order: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  start_date: z.iso.date().nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  completion: z.number().int().min(0).max(100).nullable().optional(),
}).passthrough().refine((value) => !value.start_date || !value.due_date || value.start_date <= value.due_date, {
  message: 'Start date must be on or before the due date',
  path: ['due_date'],
});

export const planningPatchInput = z.object({
  action: z.literal('update-planning'),
  start_date: z.iso.date().nullable().optional(),
  due_date: z.iso.date().nullable().optional(),
  completion: z.number().int().min(0).max(100).nullable().optional(),
}).strict().refine((value) => value.start_date !== undefined || value.due_date !== undefined || value.completion !== undefined, {
  message: 'Choose a date or progress value to update',
});
