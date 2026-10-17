import { z } from 'zod';
export const emailInput = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .email('Enter a valid email address');
export const loginInput = z
  .object({ email: emailInput, password: z.string().min(1).max(128) })
  .strict();
export const registerInput = z
  .object({
    name: z.string().trim().min(2, 'Enter at least 2 characters for your name').max(80),
    email: emailInput,
    password: z.string().min(12, 'Use at least 12 characters for your password').max(128),
    confirm_password: z.string().max(128),
  })
  .strict()
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  });
