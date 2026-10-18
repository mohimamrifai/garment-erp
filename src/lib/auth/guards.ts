import { ApiError } from "@/lib/api/errors";
import { can, type Permission } from "@/lib/permissions";
import { getSessionUserFromHeaders, type SessionUser } from "./session";

/**
 * Guard untuk route handler API. Melempar `ApiError` (401/403) yang otomatis
 * dipetakan oleh `handleApiError()`.
 */
export async function requireApiAuth(request: Request): Promise<SessionUser> {
  const user = await getSessionUserFromHeaders(request.headers);
  if (!user) throw ApiError.unauthorized();
  return user;
}

export async function requireApiPermission(
  request: Request,
  permission: Permission,
): Promise<SessionUser> {
  const user = await requireApiAuth(request);
  if (!can(user.roles, permission)) throw ApiError.forbidden();
  return user;
}
