import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcryptjs';

// Database configuration
const poolConfig = {
  connectionString: process.env.DATABASE_URL,
  min: parseInt(process.env.DB_POOL_MIN || '2'),
  max: parseInt(process.env.DB_POOL_MAX || '20'),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000'),
};

// Create connection pool
const pool = new Pool(poolConfig);

// Database interface compatible with SQLite's better-sqlite3
class SupabaseDatabase {
  private pool: Pool;
  private currentTenantId: number | null = null;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  // Set current tenant context for Row Level Security
  setTenantContext(tenantId: number): void {
    this.currentTenantId = tenantId;
  }

  clearTenantContext(): void {
    this.currentTenantId = null;
  }

  // Execute a query and return all rows
  all(sql: string, params: any[] = []): any[] {
    return this.query(sql, params);
  }

  // Execute a query and return first row
  get(sql: string, params: any[] = []): any | undefined {
    const results = this.query(sql, params);
    return results.length > 0 ? results[0] : undefined;
  }

  // Execute a query and return run info
  run(sql: string, params: any[] = []): { lastInsertRowid: number; changes: number } {
    const client = this.pool.connect();
    try {
      // Set tenant context if available
      if (this.currentTenantId) {
        client.query(`SET LOCAL app.current_tenant_id = '${this.currentTenantId}'`);
      }

      const result = client.query(sql, params);
      return {
        lastInsertRowid: result.rows[0]?.id || 0,
        changes: result.rowCount || 0
      };
    } finally {
      client.release();
    }
  }

  // Execute a query (internal method)
  private query(sql: string, params: any[] = []): any[] {
    const client = this.pool.connect();
    try {
      // Set tenant context if available
      if (this.currentTenantId) {
        client.query(`SET LOCAL app.current_tenant_id = '${this.currentTenantId}'`);
      }

      const result = client.query(sql, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Execute multiple statements in a transaction
  exec(sql: string): void {
    const client = this.pool.connect();
    try {
      client.query('BEGIN');
      const statements = sql.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          client.query(statement);
        }
      }
      client.query('COMMIT');
    } catch (error) {
      client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Prepare a statement (for compatibility)
  prepare(sql: string): any {
    const self = this;
    return {
      all(params: any[] = []): any[] {
        return self.all(sql, params);
      },
      get(params: any[] = []): any | undefined {
        return self.get(sql, params);
      },
      run(params: any[] = []): { lastInsertRowid: number; changes: number } {
        return self.run(sql, params);
      }
    };
  }

  // Transaction support
  transaction<T>(fn: (db: SupabaseDatabase) => T): T {
    const client = this.pool.connect();
    try {
      client.query('BEGIN');

      // Create transaction-specific database instance
      const transactionDb = new SupabaseDatabase(client as any);
      if (this.currentTenantId) {
        transactionDb.setTenantContext(this.currentTenantId);
      }

      const result = fn(transactionDb);
      client.query('COMMIT');
      return result;
    } catch (error) {
      client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Close database connection
  close(): void {
    this.pool.end();
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT NOW()');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

// Create database instance
const db = new SupabaseDatabase(pool);

// Initialize database with seed data
export async function initDb(): Promise<void> {
  try {
    console.log('Initializing Supabase database...');

    // Check if database is accessible
    const isHealthy = await db.healthCheck();
    if (!isHealthy) {
      throw new Error('Database connection failed');
    }

    console.log('✅ Database connection successful');

    // Check if we need to seed data
    const tenantCount = db.get("SELECT COUNT(*) as count FROM tenants") as { count: number };
    if (tenantCount && tenantCount.count === 0) {
      console.log('🌱 Seeding initial data...');
      seedData();
      console.log('✅ Initial data seeded successfully');
    } else {
      console.log('✅ Database already contains data');
    }

  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Seed data function
function seedData(): void {
  try {
    // Insert default tenant
    db.prepare(`
      INSERT INTO tenants (id, nombre, ruc, dominio, plan, estado, configuracion_json)
      VALUES (1, 'Empresa Demo Transportadora', '80012345-6', 'demo.local', 'demo', 'activo', '{}')
      ON CONFLICT (id) DO NOTHING
    `).run();

    // Insert default permissions
    const permisos = [
      'users.manage', 'pedidos.read', 'pedidos.create', 'pedidos.update', 'pedidos.delete',
      'viajes.manage', 'finanzas.manage', 'rrhh.manage', 'flota.manage', 'reportes.read',
      'configuracion.manage', 'clientes.portal'
    ];

    const insertPermiso = db.prepare("INSERT INTO permisos (clave, descripcion) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING");
    permisos.forEach(permiso => {
      insertPermiso.run(permiso, permiso);
    });

    // Insert default role permissions
    const rolePermissions: Record<string, string[]> = {
      superadmin_saas: permisos,
      admin_empresa: permisos,
      operador: ['pedidos.read', 'pedidos.create', 'pedidos.update', 'viajes.manage', 'flota.manage', 'reportes.read'],
      financiero: ['pedidos.read', 'finanzas.manage', 'reportes.read'],
      rrhh: ['rrhh.manage', 'reportes.read'],
      despachante: ['pedidos.read', 'pedidos.update', 'viajes.manage', 'flota.manage'],
      chofer: ['pedidos.read'],
      cliente_portal: ['clientes.portal']
    };

    const insertRolePermission = db.prepare("INSERT INTO roles_permisos (role, permiso) VALUES ($1, $2) ON CONFLICT (role, permiso) DO NOTHING");
    Object.entries(rolePermissions).forEach(([role, rolePermisos]) => {
      rolePermisos.forEach(permiso => {
        insertRolePermission.run(role, permiso);
      });
    });

    // Insert default admin user (password: admin123)
    const admin = db.get("SELECT * FROM users WHERE username = 'admin'") as any;
    const adminHash = bcrypt.hashSync('admin123', 10);
    if (!admin) {
      db.prepare(`
        INSERT INTO users (tenant_id, username, password, password_hash, role, nombre, estado)
        VALUES (1, 'admin', '', $1, 'superadmin_saas', 'Superadmin SaaS', 'activo')
      `).run(adminHash);
    } else if (!admin.password_hash) {
      db.prepare(`
        UPDATE users
        SET tenant_id = COALESCE(tenant_id, 1),
            password_hash = $1,
            role = CASE WHEN role = 'admin' THEN 'superadmin_saas' ELSE role END,
            estado = COALESCE(estado, 'activo')
        WHERE id = $2
      `).run(adminHash, admin.id);
    }

    // Insert default configuration
    const insertConfig = db.prepare("INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor");
    insertConfig.run('membrete', 'TRANSPORTADORA PARAGUAY SAAS\\nRUC: 80012345-6\\nTel: 0981 000 000');
    insertConfig.run('ticket_width_chars', '32');
    insertConfig.run('ticket_copies', '2');
    insertConfig.run('moneda', 'PYG');
    insertConfig.run('idioma', 'es');

    // Insert seed data for other tables
    seedSucursales();
    seedClientes();
    seedChoferes();
    seedVehiculos();
    seedPedidos();

    console.log('✅ All seed data inserted successfully');

  } catch (error) {
    console.error('❌ Failed to seed data:', error);
    throw error;
  }
}

// Additional seed functions
function seedSucursales(): void {
  const count = db.get("SELECT COUNT(*) as count FROM sucursales") as { count: number };
  if (count.count === 0) {
    const insertSucursal = db.prepare(`
      INSERT INTO sucursales (nombre, codigo, direccion, ciudad, departamento, telefono, responsable, estado, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `);

    insertSucursal.run('Asunción Central', 'ASU-01', 'Av. Artigas 1234', 'Asunción', 'Capital', '021-123-456', 'Juan Pérez', 'activo', 1);
    insertSucursal.run('Ciudad del Este', 'CDE-01', 'Ruta 7 km 4', 'Ciudad del Este', 'Alto Paraná', '061-123-456', 'María Gómez', 'activo', 1);
    insertSucursal.run('Encarnación', 'ENC-01', 'Ruta 1 km 2', 'Encarnación', 'Itapúa', '071-123-456', 'Carlos López', 'activo', 1);
  }
}

function seedClientes(): void {
  const count = db.get("SELECT COUNT(*) as count FROM clientes") as { count: number };
  if (count.count === 0) {
    const insertCliente = db.prepare(`
      INSERT INTO clientes (nombre, ruc, direccion, telefono, tipo, email, condiciones_comerciales, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `);

    insertCliente.run('Empresa Tech SRL', '80012345-1', 'Centro 55', '0981123456', 'empresa', 'info@tech.com', 'Crédito 30 días', 1);
    insertCliente.run('Juan Perez', '1234567-8', 'Barrio Obrero', '0991123456', 'persona', 'juan@gmail.com', 'Contado', 1);

    // Initialize cuentas corrientes
    const insertCuenta = db.prepare(`
      INSERT INTO cuentas_corrientes_clientes (cliente_id, saldo_deudor, limite_credito, tenant_id)
      VALUES ($1, $2, $3, $4)
    `);
    insertCuenta.run(1, 0, 10000000, 1);
    insertCuenta.run(2, 0, 500000, 1);
  }
}

function seedChoferes(): void {
  const count = db.get("SELECT COUNT(*) as count FROM choferes") as { count: number };
  if (count.count === 0) {
    const insertChofer = db.prepare(`
      INSERT INTO choferes (nombre, documento, licencia, telefono, estado, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `);

    insertChofer.run('Pedro Chofer', '4445556', 'Cat B', '0982223344', 'activo', 1);
    insertChofer.run('Luis Volante', '3334445', 'Cat C', '0992334455', 'activo', 1);
  }
}

function seedVehiculos(): void {
  const count = db.get("SELECT COUNT(*) as count FROM vehiculos") as { count: number };
  if (count.count === 0) {
    const insertVehiculo = db.prepare(`
      INSERT INTO vehiculos (chapa, marca, modelo, capacidad, estado, tenant_id)
      VALUES ($1, $2, $3, $4, $5, $6)
    `);

    insertVehiculo.run('AAA 111', 'Toyota', 'Dyna', 3500, 'disponible', 1);
    insertVehiculo.run('BBB 222', 'Mercedes', 'Sprinter', 5000, 'disponible', 1);
  }
}

function seedPedidos(): void {
  const count = db.get("SELECT COUNT(*) as count FROM pedidos") as { count: number };
  if (count.count === 0) {
    const insertPedido = db.prepare(`
      INSERT INTO pedidos (
        numero_guia, cliente_pagador_id, remitente_nombre, remitente_doc, remitente_tel, remitente_direccion,
        destinatario_nombre, destinatario_doc, destinatario_tel, destinatario_direccion,
        sucursal_origen_id, sucursal_destino_id, modalidad_retiro, modalidad_entrega,
        cantidad_bultos, peso, volumen, valor_declarado, precio, tipo_pago, estado,
        fecha_prevista, tipo_carga, tenant_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24
      )
    `);

    insertPedido.run(
      'GUIA-10001', 1,
      'Empresa Tech SRL', '80012345-1', '0981123456', 'Centro 55',
      'Cliente Final 1', '5556667', '0971223344', 'Barrio San Pablo',
      1, 2, 'puerta', 'puerta',
      5, 120.5, 2.5, 5000000, 250000, 'credito', 'registrado',
      '2024-12-30', 'Electrónicos', 1
    );
  }
}

// Export database instance and initialization function
export default db;
export { SupabaseDatabase };
