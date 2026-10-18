import { z } from "zod";
import { ROLE_CODES } from "@/lib/permissions";

export const roleCodeSchema = z.enum(ROLE_CODES);

export const listUsersQuerySchema = z.object({
  query: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

export const createUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
  email: z.email("Format email tidak valid."),
  password: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(72, "Password maksimal 72 karakter."),
  roleCodes: z.array(roleCodeSchema).min(1, "Pilih minimal satu role."),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama minimal 2 karakter.")
    .max(100, "Nama maksimal 100 karakter."),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserRolesSchema = z.object({
  roleCodes: z.array(roleCodeSchema).min(1, "Pilih minimal satu role."),
});
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;

export const setUserPasswordSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Password minimal 8 karakter.")
    .max(72, "Password maksimal 72 karakter."),
});
export type SetUserPasswordInput = z.infer<typeof setUserPasswordSchema>;

export const setUserBanSchema = z.object({
  banned: z.boolean(),
  reason: z.string().trim().max(200, "Alasan maksimal 200 karakter.").optional(),
});
export type SetUserBanInput = z.infer<typeof setUserBanSchema>;
