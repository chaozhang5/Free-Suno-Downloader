type ZipFile = { name: string; bytes: Uint8Array };

const encoder = new TextEncoder();
const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = table[(value ^ byte) & 255] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export function createZip(files: ZipFile[]): Blob {
  if (!files.length || files.length > 100) throw new Error('There are no files to package.');
  const parts: BlobPart[] = [];
  const directory: BlobPart[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    if (name.length > 65535 || file.bytes.length > 0xffffffff) throw new Error('A file is too large for ZIP.');
    const checksum = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const header = new DataView(local.buffer);
    header.setUint32(0, 0x04034b50, true);
    header.setUint16(4, 20, true);
    header.setUint16(6, 0x0800, true);
    header.setUint32(14, checksum, true);
    header.setUint32(18, file.bytes.length, true);
    header.setUint32(22, file.bytes.length, true);
    header.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, new Uint8Array(file.bytes));

    const central = new Uint8Array(46 + name.length);
    const entry = new DataView(central.buffer);
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint32(16, checksum, true);
    entry.setUint32(20, file.bytes.length, true);
    entry.setUint32(24, file.bytes.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += local.length + file.bytes.length;
  }
  const directorySize = directory.reduce((size, entry) => size + (entry as Uint8Array).length, 0);
  if (offset + directorySize > 0xffffffff) throw new Error('The ZIP is too large.');
  const end = new Uint8Array(22);
  const footer = new DataView(end.buffer);
  footer.setUint32(0, 0x06054b50, true);
  footer.setUint16(8, files.length, true);
  footer.setUint16(10, files.length, true);
  footer.setUint32(12, directorySize, true);
  footer.setUint32(16, offset, true);
  return new Blob([...parts, ...directory, end], { type: 'application/zip' });
}
