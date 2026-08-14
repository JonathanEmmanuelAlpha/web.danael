import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Charger le bon fichier .env selon NODE_ENV
dotenv.config();

const isDevelopment = process.env.NODE_ENV === "development";
const connectionString = isDevelopment
  ? process.env.LOCAL_DATABASE_URL
  : process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    `Missing database connection string for ${isDevelopment ? "development" : "production"} environment.`,
  );
}

export default defineConfig({
  dialect: "postgresql", // utilise le driver pg pour toutes les environnements
  dbCredentials: {
    url: connectionString,
  },
  schema: "./server/db/schema/*.ts", // ajustez selon votre structure
  out: "./server/db/migrations", // dossier des migrations
  verbose: true, // active les logs détaillés
  strict: true,
});
