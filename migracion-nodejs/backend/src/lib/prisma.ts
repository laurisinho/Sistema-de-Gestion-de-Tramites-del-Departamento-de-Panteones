import { PrismaClient } from "@prisma/client";

// Singleton: evita abrir un pool de conexiones nuevo en cada recarga de tsx watch.
export const prisma = new PrismaClient();
