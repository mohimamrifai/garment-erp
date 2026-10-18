import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { buyers, roles, userRoles } from "@/lib/db/schema";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo-accounts";
import { ROLE_SEED, type RoleCode } from "@/lib/permissions";
import { nextDocumentNumber } from "@/lib/utils/documents";

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD ?? DEMO_PASSWORD;

/** Satu akun demo per role (sumber: src/lib/demo-accounts.ts). */
const SEED_USERS = DEMO_ACCOUNTS;

const SAMPLE_BUYERS: readonly {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
}[] = [
  {
    name: "PT Maju Garmen Sejahtera",
    contactPerson: "Budi Santoso",
    phone: "021-5550101",
    email: "budi@majugarmen.co.id",
    address: "Jl. Industri Raya No. 12, Jakarta Pusat",
  },
  {
    name: "CV Karya Tekstil Nusantara",
    contactPerson: "Siti Rahayu",
    phone: "022-4440202",
    email: "siti@karyatekstil.co.id",
    address: "Jl. Cigondewah No. 88, Bandung",
  },
  {
    name: "Global Apparel Trading Pte Ltd",
    contactPerson: "James Lim",
    phone: "+65-6222-3333",
    email: "james.lim@globalapparel.sg",
    address: "18 Robinson Road, Singapore",
  },
];

async function seedRoles(): Promise<Map<RoleCode, string>> {
  for (const role of ROLE_SEED) {
    await db.insert(roles).values(role).onConflictDoNothing({ target: roles.code });
  }
  const rows = await db.select({ id: roles.id, code: roles.code }).from(roles);
  const map = new Map<RoleCode, string>();
  for (const row of rows) {
    map.set(row.code as RoleCode, row.id);
  }
  return map;
}

async function seedUsers(roleIds: Map<RoleCode, string>): Promise<void> {
  const ctx = await auth.$context;

  for (const seedUser of SEED_USERS) {
    const existing = await ctx.internalAdapter.findUserByEmail(seedUser.email);
    let userId: string;

    if (existing?.user) {
      userId = existing.user.id;
    } else {
      const created = await ctx.internalAdapter.createUser(
        {
          name: seedUser.name,
          email: seedUser.email,
          emailVerified: true,
          role: seedUser.roleCode === "ADMIN" ? "admin" : "user",
        },
        { method: "email-password" },
      );
      await ctx.internalAdapter.linkAccount({
        userId: created.id,
        providerId: "credential",
        accountId: created.id,
        password: await ctx.password.hash(DEFAULT_PASSWORD),
      });
      userId = created.id;
    }

    const roleId = roleIds.get(seedUser.roleCode);
    if (roleId) {
      await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
    }
  }
}

async function seedBuyers(): Promise<void> {
  const existing = await db.select({ id: buyers.id }).from(buyers).limit(1);
  if (existing.length > 0) return;

  for (const buyer of SAMPLE_BUYERS) {
    const code = await nextDocumentNumber(db, "BUY", { period: null });
    await db.insert(buyers).values({ ...buyer, code });
  }
}

/**
 * Seed idempotent untuk development: 8 role, satu akun demo per role,
 * dan beberapa contoh buyer.
 */
export async function runSeed(): Promise<void> {
  console.log("Seed: roles...");
  const roleIds = await seedRoles();

  console.log("Seed: users...");
  await seedUsers(roleIds);

  console.log("Seed: buyers contoh...");
  await seedBuyers();

  const adminEmail = SEED_USERS.find((u) => u.roleCode === "ADMIN")!.email;
  console.log(`Seed selesai. Akun admin: ${adminEmail} (password: ${DEFAULT_PASSWORD}).`);
}
