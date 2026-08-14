import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import path from "path";
import dotenv from "dotenv";

// Charger le fichier .env approprié
const envFile =
  process.env.NODE_ENV === "development" ? ".env.development" : ".env";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

console.log("=== MIGRATION MANUELLE ===");
console.log("NODE_ENV:", process.env.NODE_ENV);
console.log("Fichier .env utilisé:", envFile);

// Récupérer la chaîne de connexion
const isDevelopment = process.env.NODE_ENV === "development";
const connectionString = isDevelopment
  ? process.env.LOCAL_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ Variable d'environnement manquante :");
  console.error("   - En développement : LOCAL_DATABASE_URL");
  console.error("   - En production : DATABASE_URL");
  process.exit(1);
}

// Masquer les identifiants pour les logs
const masked = connectionString.replace(/\/\/[^@]*@/, "//****:****@");
console.log("URL de connexion:", masked);

// Créer le pool de connexion
const pool = new Pool({ connectionString });

// Tester la connexion avant de lancer la migration
pool
  .connect()
  .then((client) => {
    console.log("✅ Connexion à la base de données établie.");
    client.release();
  })
  .catch((err) => {
    console.error("❌ Échec de la connexion à la base :", err.message);
    process.exit(1);
  });

const db = drizzle(pool);

async function runMigration() {
  console.log("📦 Démarrage des migrations...");
  try {
    // Utilisation de migrate avec le chemin du dossier des migrations
    await migrate(db as any, {
      migrationsFolder: path.resolve(process.cwd(), "server/db/migrations"),
    });
    console.log("✅ Migrations exécutées avec succès !");
  } catch (error: any) {
    console.error("❌ Erreur lors des migrations :");
    if (error instanceof Error) {
      console.error("Message :", error.message);
      console.error("Stack :", error.stack);
    } else {
      console.error(error);
    }
    process.exit(1);
  } finally {
    await pool.end();
    console.log("🔌 Connexion fermée.");
  }
}

runMigration();
