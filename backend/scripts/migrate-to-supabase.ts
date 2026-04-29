import Database from 'better-sqlite3';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const SQLITE_DB_PATH = path.join(__dirname, '../transportadora.db');
const SUPABASE_CONNECTION_STRING = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/postgres';

// Initialize SQLite connection
const sqliteDb = new Database(SQLITE_DB_PATH);

// Initialize PostgreSQL connection
const pgPool = new Pool({
  connectionString: SUPABASE_CONNECTION_STRING,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Migration statistics
const migrationStats = {
  totalTables: 0,
  migratedTables: 0,
  failedTables: 0,
  totalRows: 0,
  migratedRows: 0,
  failedRows: 0,
  startTime: new Date(),
  endTime: null as Date | null,
  errors: [] as string[],
};

// Table mapping: SQLite table -> PostgreSQL table
const tableMappings = [
  { sqlite: 'tenants', postgresql: 'tenants' },
  { sqlite: 'users', postgresql: 'users' },
  { sqlite: 'sucursales', postgresql: 'sucursales' },
  { sqlite: 'clientes', postgresql: 'clientes' },
  { sqlite: 'choferes', postgresql: 'choferes' },
  { sqlite: 'vehiculos', postgresql: 'vehiculos' },
  { sqlite: 'viajes', postgresql: 'viajes' },
  { sqlite: 'pedidos', postgresql: 'pedidos' },
  { sqlite: 'evidencias_pedido', postgresql: 'evidencias_pedido' },
  { sqlite: 'tracking', postgresql: 'tracking' },
  { sqlite: 'combustible', postgresql: 'combustible' },
  { sqlite: 'configuracion', postgresql: 'configuracion' },
  { sqlite: 'movimientos_caja', postgresql: 'movimientos_caja' },
  { sqlite: 'rendiciones_chofer', postgresql: 'rendiciones_chofer' },
  { sqlite: 'gastos_operativos', postgresql: 'gastos_operativos' },
  { sqlite: 'cuentas_corrientes_clientes', postgresql: 'cuentas_corrientes_clientes' },
  { sqlite: 'pagos_clientes', postgresql: 'pagos_clientes' },
  { sqlite: 'rrhh_empleados', postgresql: 'rrhh_empleados' },
  { sqlite: 'rrhh_asistencias', postgresql: 'rrhh_asistencias' },
  { sqlite: 'rrhh_licencias', postgresql: 'rrhh_licencias' },
  { sqlite: 'rrhh_nomina', postgresql: 'rrhh_nomina' },
  { sqlite: 'rrhh_capacitaciones', postgresql: 'rrhh_capacitaciones' },
  { sqlite: 'proveedores', postgresql: 'proveedores' },
  { sqlite: 'compras', postgresql: 'compras' },
  { sqlite: 'mantenimientos_vehiculo', postgresql: 'mantenimientos_vehiculo' },
  { sqlite: 'incidencias_operativas', postgresql: 'incidencias_operativas' },
  { sqlite: 'inventario_deposito', postgresql: 'inventario_deposito' },
  { sqlite: 'tarifarios', postgresql: 'tarifarios' },
  { sqlite: 'contratos_clientes', postgresql: 'contratos_clientes' },
  { sqlite: 'permisos', postgresql: 'permisos' },
  { sqlite: 'roles_permisos', postgresql: 'roles_permisos' },
  { sqlite: 'refresh_tokens', postgresql: 'refresh_tokens' },
  { sqlite: 'audit_logs', postgresql: 'audit_logs' },
  { sqlite: 'reglas_operativas', postgresql: 'reglas_operativas' },
  { sqlite: 'reglas_ejecuciones', postgresql: 'reglas_ejecuciones' },
  { sqlite: 'alertas', postgresql: 'alertas' },
  { sqlite: 'rutas_planificadas', postgresql: 'rutas_planificadas' },
  { sqlite: 'paradas_ruta', postgresql: 'paradas_ruta' },
  { sqlite: 'facturas', postgresql: 'facturas' },
  { sqlite: 'factura_items', postgresql: 'factura_items' },
  { sqlite: 'clientes_usuarios', postgresql: 'clientes_usuarios' },
];

// Function to convert SQLite row to PostgreSQL compatible format
function convertRowForPostgres(row: any, tableName: string): any {
  const converted: any = { ...row };

  // Handle specific conversions based on table
  switch (tableName) {
    case 'users':
      // Convert role to enum if needed
      if (converted.role && !['superadmin_saas', 'admin_empresa', 'operador', 'financiero', 'rrhh', 'despachante', 'chofer', 'cliente_portal'].includes(converted.role)) {
        converted.role = 'operador'; // Default fallback
      }
      break;

    case 'roles_permisos':
      // Convert role to enum
      if (converted.role && !['superadmin_saas', 'admin_empresa', 'operador', 'financiero', 'rrhh', 'despachante', 'chofer', 'cliente_portal'].includes(converted.role)) {
        converted.role = 'operador';
      }
      break;

    case 'tenants':
    case 'sucursales':
    case 'clientes':
    case 'choferes':
    case 'vehiculos':
    case 'viajes':
    case 'pedidos':
    case 'tracking':
    case 'combustible':
    case 'movimientos_caja':
    case 'rendiciones_chofer':
    case 'gastos_operativos':
    case 'cuentas_corrientes_clientes':
    case 'pagos_clientes':
    case 'rrhh_empleados':
    case 'rrhh_asistencias':
    case 'rrhh_licencias':
    case 'rrhh_nomina':
    case 'rrhh_capacitaciones':
    case 'proveedores':
    case 'compras':
    case 'mantenimientos_vehiculo':
    case 'incidencias_operativas':
    case 'inventario_deposito':
    case 'tarifarios':
    case 'contratos_clientes':
    case 'rutas_planificadas':
    case 'paradas_ruta':
    case 'facturas':
    case 'factura_items':
    case 'clientes_usuarios':
      // Convert tenant_id if exists
      if (converted.tenant_id === undefined || converted.tenant_id === null) {
        converted.tenant_id = 1; // Default to tenant 1
      }
      break;

    case 'configuracion':
      // Handle tenant_id for configuracion
      if (converted.tenant_id === undefined || converted.tenant_id === null) {
        delete converted.tenant_id; // Remove if null, as it might be optional
      }
      break;
  }

  // Handle JSON fields
  const jsonFields = ['configuracion_json', 'permisos_json', 'antes_json', 'despues_json', 'condicion_json', 'accion_json', 'detalle_json', 'evidencia_json'];
  jsonFields.forEach(field => {
    if (converted[field]) {
      try {
        if (typeof converted[field] === 'string') {
          converted[field] = JSON.parse(converted[field]);
        }
      } catch (e) {
        console.warn(`Failed to parse JSON field ${field} in table ${tableName}:`, e);
        converted[field] = {};
      }
    }
  });

  // Handle boolean conversions
  const booleanFields = ['activo', 'requiere_frio', 'fragil'];
  booleanFields.forEach(field => {
    if (converted[field] !== undefined) {
      converted[field] = Boolean(converted[field]);
    }
  });

  // Remove SQLite-specific fields
  delete converted._rowid_;
  delete converted.rowid;

  return converted;
}

// Function to get column names for a table
function getTableColumns(tableName: string): string[] {
  try {
    const result = sqliteDb.prepare(`PRAGMA table_info(${tableName})`).all();
    return result.map((row: any) => row.name);
  } catch (error) {
    console.error(`Error getting columns for table ${tableName}:`, error);
    return [];
  }
}

// Function to migrate a single table
async function migrateTable(mapping: { sqlite: string; postgresql: string }): Promise<void> {
  const { sqlite, postgresql } = mapping;

  console.log(`\n🔄 Migrating table: ${sqlite} -> ${postgresql}`);

  try {
    // Get all data from SQLite
    const columns = getTableColumns(sqlite);
    if (columns.length === 0) {
      console.log(`⚠️  No columns found for table ${sqlite}, skipping...`);
      return;
    }

    const selectQuery = `SELECT ${columns.join(', ')} FROM ${sqlite}`;
    const rows = sqliteDb.prepare(selectQuery).all();

    if (rows.length === 0) {
      console.log(`✅ No data to migrate for table ${sqlite}`);
      migrationStats.migratedTables++;
      return;
    }

    console.log(`📊 Found ${rows.length} rows in ${sqlite}`);

    // Prepare insert query for PostgreSQL
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const insertQuery = `INSERT INTO ${postgresql} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;

    // Migrate each row
    let migratedCount = 0;
    let failedCount = 0;

    for (const row of rows) {
      try {
        const convertedRow = convertRowForPostgres(row, sqlite);
        const values = columns.map(col => convertedRow[col]);

        await pgPool.query(insertQuery, values);
        migratedCount++;
      } catch (error: any) {
        failedCount++;
        const errorMsg = `Failed to migrate row in ${sqlite}: ${error.message}`;
        console.error(`❌ ${errorMsg}`);
        migrationStats.errors.push(errorMsg);
      }
    }

    console.log(`✅ Successfully migrated ${migratedCount} rows from ${sqlite}`);
    if (failedCount > 0) {
      console.log(`⚠️  Failed to migrate ${failedCount} rows from ${sqlite}`);
    }

    migrationStats.migratedTables++;
    migrationStats.migratedRows += migratedCount;
    migrationStats.failedRows += failedCount;
    migrationStats.totalRows += rows.length;

  } catch (error: any) {
    console.error(`❌ Error migrating table ${sqlite}:`, error.message);
    migrationStats.failedTables++;
    migrationStats.errors.push(`Failed to migrate table ${sqlite}: ${error.message}`);
  }
}

// Function to verify migration
async function verifyMigration(): Promise<void> {
  console.log('\n🔍 Verifying migration...');

  for (const mapping of tableMappings) {
    try {
      // Get count from SQLite
      const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${mapping.sqlite}`).get() as { count: number };

      // Get count from PostgreSQL
      const pgResult = await pgPool.query(`SELECT COUNT(*) as count FROM ${mapping.postgresql}`);
      const pgCount = parseInt(pgResult.rows[0].count);

      if (sqliteCount.count === pgCount) {
        console.log(`✅ ${mapping.sqlite}: ${sqliteCount.count} rows (verified)`);
      } else {
        console.log(`⚠️  ${mapping.sqlite}: SQLite=${sqliteCount.count}, PostgreSQL=${pgCount} (mismatch)`);
      }
    } catch (error: any) {
      console.error(`❌ Error verifying ${mapping.sqlite}:`, error.message);
    }
  }
}

// Function to print migration statistics
function printStatistics(): void {
  migrationStats.endTime = new Date();
  const duration = migrationStats.endTime.getTime() - migrationStats.startTime.getTime();

  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION STATISTICS');
  console.log('='.repeat(60));
  console.log(`Total Tables: ${migrationStats.totalTables}`);
  console.log(`Migrated Tables: ${migrationStats.migratedTables}`);
  console.log(`Failed Tables: ${migrationStats.failedTables}`);
  console.log(`Total Rows: ${migrationStats.totalRows}`);
  console.log(`Migrated Rows: ${migrationStats.migratedRows}`);
  console.log(`Failed Rows: ${migrationStats.failedRows}`);
  console.log(`Duration: ${(duration / 1000).toFixed(2)} seconds`);
  console.log(`Success Rate: ${((migrationStats.migratedRows / migrationStats.totalRows) * 100).toFixed(2)}%`);

  if (migrationStats.errors.length > 0) {
    console.log('\n❌ ERRORS:');
    migrationStats.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error}`);
    });
  }

  console.log('='.repeat(60));
}

// Main migration function
async function migrateToSupabase(): Promise<void> {
  console.log('🚀 Starting migration from SQLite to Supabase...');
  console.log(`📅 Started at: ${migrationStats.startTime.toISOString()}`);

  try {
    // Test PostgreSQL connection
    console.log('\n🔌 Testing PostgreSQL connection...');
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful');

    // Get list of tables in SQLite
    const tables = sqliteDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { name: string }[];
    migrationStats.totalTables = tables.length;

    console.log(`\n📋 Found ${tables.length} tables in SQLite database`);

    // Migrate each table
    for (const mapping of tableMappings) {
      await migrateTable(mapping);
    }

    // Verify migration
    await verifyMigration();

    // Print statistics
    printStatistics();

    console.log('\n✅ Migration completed successfully!');

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    // Close connections
    sqliteDb.close();
    await pgPool.end();
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateToSupabase().catch(error => {
    console.error('Fatal error during migration:', error);
    process.exit(1);
  });
}

export { migrateToSupabase, migrationStats };