"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/** Klien Better Auth untuk Client Components (same-origin, tanpa baseURL). */
export const authClient = createAuthClient({
  plugins: [adminClient()],
});
