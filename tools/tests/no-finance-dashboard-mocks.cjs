const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');
const files = [
  'frontend/src/pages/Dashboard.tsx',
  'frontend/src/pages/Caja.tsx',
  'frontend/src/pages/Ingresos.tsx',
  'frontend/src/pages/CuentasCorrientes.tsx',
  'frontend/src/pages/Viaticos.tsx',
  'frontend/src/pages/Reportes.tsx'
];

const forbidden = [
  'Supermercados Stock',
  'Farmacenter',
  'Luis Díaz',
  'Luis D',
  'Tech SRL',
  'AP-001',
  'VI-102',
  'RC-889',
  'Pago Fac #1010',
  'Carlos R.',
  'V-1025',
  'V-1026',
  'GUIA-900',
  'GUIA-901',
  'FAC-001',
  'FAC-002',
  'AAA-111',
  'BBB-222',
  'AAA 111',
  'BBB 222',
  '45000000',
  '45,000,000',
  '18500000',
  '18,500,000',
  '26500000',
  '26,500,000',
  '10,700,000',
  '550,000',
  '2700000',
  '10700000'
];

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  for (const value of forbidden) {
    assert.equal(content.includes(value), false, `${file} contiene dato demo: ${value}`);
  }
}

console.log('OK finance/dashboard pages do not contain demo records');
