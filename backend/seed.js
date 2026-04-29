const Database = require('better-sqlite3');
const db = new Database('transportadora.db');

console.log("Seeding database...");

try {
  // Clientes
  db.prepare("INSERT INTO clientes (nombre, ruc, direccion, telefono) VALUES ('Supermercados Stock', '80012345-6', 'Av. Artigas', '021 555 555')").run();
  db.prepare("INSERT INTO clientes (nombre, ruc, direccion, telefono) VALUES ('Farmacenter', '80098765-4', 'Av. España', '021 444 444')").run();

  // Choferes
  db.prepare("INSERT INTO choferes (nombre, documento, licencia, telefono) VALUES ('Juan Perez', '4567890', 'B Profesional', '0981 123 456')").run();
  db.prepare("INSERT INTO choferes (nombre, documento, licencia, telefono) VALUES ('Carlos Gomez', '3456789', 'B Profesional', '0971 987 654')").run();

  // Vehiculos
  db.prepare("INSERT INTO vehiculos (chapa, marca, modelo, capacidad) VALUES ('AAB 123', 'Scania', 'P360', 15000)").run();
  db.prepare("INSERT INTO vehiculos (chapa, marca, modelo, capacidad) VALUES ('XCD 456', 'Mercedes', 'Axor', 12000)").run();

  // Pedidos
  db.prepare("INSERT INTO pedidos (cliente_id, origen, destino, fecha_prevista, tipo_carga) VALUES (1, 'Depósito Central', 'Stock San Lorenzo', '2026-04-20', 'Pallets')").run();
  db.prepare("INSERT INTO pedidos (cliente_id, origen, destino, fecha_prevista, tipo_carga) VALUES (2, 'Depósito Central', 'Farmacenter Centro', '2026-04-21', 'Cajas Medicamentos')").run();

  // Initial Tracking positions (Asunción area)
  db.prepare("INSERT INTO tracking (vehiculo_id, latitud, longitud, timestamp) VALUES (1, -25.2865, -57.6363, datetime('now'))").run();
  db.prepare("INSERT INTO tracking (vehiculo_id, latitud, longitud, timestamp) VALUES (2, -25.2955, -57.6250, datetime('now'))").run();

  console.log("Seed complete.");
} catch (e) {
  console.error("Error seeding:", e.message);
}
