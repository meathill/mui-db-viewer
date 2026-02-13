import type { DatabaseConnection, DatabaseType, Env } from '../../types';
import { D1Driver } from './d1';
import type { IDatabaseDriver } from './interface';
import { MySQLDriver } from './mysql';
import { PostgresDriver } from './postgres';
import { SQLiteDriver } from './sqlite';
import { TiDBDriver } from './tidb';

interface DriverFactoryContext {
  config: DatabaseConnection;
  password?: string;
  env?: Env;
}

type DriverFactory = (context: DriverFactoryContext) => IDatabaseDriver;

function createD1Driver(context: DriverFactoryContext): IDatabaseDriver {
  if (!context.env?.DB) {
    throw new Error('D1 database binding not found in environment');
  }

  return new D1Driver(context.env.DB);
}

const DRIVER_FACTORIES: Partial<Record<DatabaseType, DriverFactory>> = {
  tidb: (context) => new TiDBDriver(context.config, context.password),
  mysql: (context) => new MySQLDriver(context.config, context.password),
  postgres: (context) => new PostgresDriver(context.config, context.password),
  d1: createD1Driver,
  sqlite: (context) => new SQLiteDriver(context.config.database),
};

export function createDatabaseDriver(config: DatabaseConnection, password?: string, env?: Env): IDatabaseDriver {
  const factory = DRIVER_FACTORIES[config.type];

  if (!factory) {
    throw new Error(`Unsupported database type: ${config.type}`);
  }

  return factory({ config, password, env });
}
