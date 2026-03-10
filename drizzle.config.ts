import 'dotenv/config';
import { defineConfig } from "drizzle-kit";

// Explicitly load .env.local if you aren't using a framework that does it automatically
import { config } from 'dotenv';
config({ path: '.env.local' }); 

export default defineConfig({
  schema: "./db/schema.ts", // Ensure this points to your schema file
  out: "./drizzle",
  dialect: "turso",         // Use "turso" for LibSQL remote databases
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN!,
  },
});