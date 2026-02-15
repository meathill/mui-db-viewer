import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

export type D1Orm = DrizzleD1Database<typeof schema>;

export function createD1Orm(env: Pick<CloudflareBindings, 'DB'>): D1Orm {
  return drizzle(env.DB, { schema });
}
