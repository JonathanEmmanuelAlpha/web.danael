/**
 * Client Drizzle ORM.
 *
 * Mode triple :
 *  - Production / Staging : PostgreSQL Neon (DATABASE_URL) → neon-http
 *  - Développement local : PostgreSQL local (LOCAL_DATABASE_URL) → node-postgres (pg)
 *  - Sandbox sans DB : Mock qui renvoie des données vides (SANDBOX_MOCK_DB=true)
 *
 * L'initialisation est paresseuse (lors du premier accès à la DB) pour ne pas
 * bloquer le chargement du module / la compilation Turbopack.
 *
 * Utilisez toujours `const db = await getDb()` dans vos route handlers et server actions.
 */

import {
  drizzle as drizzleNeon,
  type NeonHttpDatabase,
} from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import {
  drizzle as drizzlePg,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const isDevelopment = process.env.NODE_ENV === "development";

// En développement on utilise LOCAL_DATABASE_URL, sinon DATABASE_URL
const localDbUrl = process.env.LOCAL_DATABASE_URL ?? "";
const neonDbUrl = process.env.DATABASE_URL ?? "";

/**
 * Type de base de données : Neon (prod) ou node-postgres (dev) ou Mock (sandbox).
 */
export type Database =
  | NeonHttpDatabase<typeof schema>
  | NodePgDatabase<typeof schema>;

/**
 * Crée une connexion vers PostgreSQL local (via node-postgres/pg)
 */
function createLocalPgDb(): NodePgDatabase<typeof schema> {
  const pool = new Pool({
    connectionString: localDbUrl,
    max: 20,
    idleTimeoutMillis: 30000,
  });
  return drizzlePg(pool, { schema });
}

/**
 * Crée une connexion vers Neon PostgreSQL (production / préproduction)
 */
function createNeonDb(): NeonHttpDatabase<typeof schema> {
  const sql = neon(neonDbUrl);
  return drizzleNeon({ client: sql, schema });
}

let _dbPromise: Promise<Database> | null = null;

/**
 * Accesseur asynchrone paresseux — point d'entrée canonique.
 *
 * En mode sandbox mock, on renvoie quand même un objet qui ressemble à une DB
 * mais qui ne fait rien (les appels vont échouer silencieusement ou renvoyer
 * des tableaux vides selon les cas). Cela permet au dev server de démarrer
 * sans crasher même sans DB réelle.
 */
export async function getDb(): Promise<Database> {
  if (!_dbPromise) {
    if (isDevelopment) {
      _dbPromise = Promise.resolve(createLocalPgDb());
    } else {
      _dbPromise = Promise.resolve(createNeonDb());
    }
  }
  return _dbPromise;
}

export { schema };
