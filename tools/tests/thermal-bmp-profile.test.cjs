const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const bmpPath = path.join(root, 'app-chofer', 'src', 'assets', 'demo.bmp');
const bytes = fs.readFileSync(bmpPath);

function readUInt16(offset) {
  return bytes.readUInt16LE(offset);
}

function readUInt32(offset) {
  return bytes.readUInt32LE(offset);
}

function readInt32(offset) {
  return bytes.readInt32LE(offset);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: esperado ${expected}, recibido ${actual}`);
  }
}

assertEqual(bytes.toString('ascii', 0, 2), 'BM', 'Firma BMP');
assertEqual(readUInt32(2), bytes.length, 'Tamano declarado BMP');

const pixelOffset = readUInt32(10);
const dibSize = readUInt32(14);
const width = readInt32(18);
const height = Math.abs(readInt32(22));
const planes = readUInt16(26);
const bpp = readUInt16(28);
const compression = readUInt32(30);
const paletteColors = readUInt32(46);
const rowBytes = Math.floor((bpp * width + 31) / 32) * 4;
const expectedRasterBytes = rowBytes * height;

assertEqual(pixelOffset, 62, 'Offset de pixeles del demo');
assertEqual(dibSize, 40, 'Cabecera DIB BITMAPINFOHEADER');
assertEqual(width, 150, 'Ancho demo.bmp');
assertEqual(height, 150, 'Alto demo.bmp');
assertEqual(planes, 1, 'Planos BMP');
assertEqual(bpp, 1, 'Profundidad BMP');
assertEqual(compression, 0, 'Compresion BMP');
assertEqual(paletteColors, 0, 'Paleta por defecto 1bpp');
assertEqual(expectedRasterBytes, bytes.length - pixelOffset, 'Peso raster BMP');
assertEqual(Math.floor((1 * 384 + 31) / 32) * 4, 48, '58mm debe producir 48 bytes por fila');
assertEqual(Math.floor((1 * 576 + 31) / 32) * 4, 72, '80mm debe producir 72 bytes por fila');

console.log('OK thermal BMP profile: demo.bmp es 150x150 1bpp y perfiles 384/576 estan alineados');
