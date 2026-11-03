import { z } from 'zod';

export const EMIRATES = ['Abu Dhabi', 'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Fujairah'] as const;
export const KINDS = ['home', 'office', 'shop', 'other'] as const;
const PHONE = /^\+?[0-9 ]{7,20}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(200),
  phone: z.string().trim().max(20).regex(PHONE).optional().or(z.literal('')).transform((v) => v || ''),
  password: z.string().min(10).max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  password: z.string().min(1).max(200),
});

export const addressSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(PHONE),
  emirate: z.enum(EMIRATES),
  area: z.string().trim().min(2).max(100),
  street: z.string().trim().min(2).max(150),
  building: z.string().trim().min(1).max(100),
  apartment: z.string().trim().max(50).optional().transform((v) => v ?? ''),
  kind: z.enum(KINDS),
  mapUrl: z.string().trim().max(500).optional().transform((v) => v ?? '')
    .refine((v) => v === '' || v.startsWith('https://'), 'https only'),
  notes: z.string().trim().max(300).optional().transform((v) => v ?? ''),
});
export type AddressInput = z.infer<typeof addressSchema>;
