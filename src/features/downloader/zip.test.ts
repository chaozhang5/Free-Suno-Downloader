import test from 'node:test';
import assert from 'node:assert/strict';
import { createZip } from './zip.ts';

test('download all packages each available file with a readable ZIP directory', async () => {
  const input = [
    { name: 'One-Trip.m4a', bytes: new Uint8Array([1, 2, 3, 4]) },
    { name: 'One-Trip.txt', bytes: new TextEncoder().encode('One trip.') },
  ];
  const data = new Uint8Array(await createZip(input).arrayBuffer());
  const view = new DataView(data.buffer);
  const footer = data.length - 22;
  assert.equal(view.getUint32(footer, true), 0x06054b50);
  assert.equal(view.getUint16(footer + 10, true), 2);
  let offset = 0;
  for (const file of input) {
    assert.equal(view.getUint32(offset, true), 0x04034b50);
    const nameSize = view.getUint16(offset + 26, true);
    const start = offset + 30 + nameSize;
    assert.equal(new TextDecoder().decode(data.subarray(offset + 30, start)), file.name);
    assert.deepEqual(data.subarray(start, start + file.bytes.length), file.bytes);
    offset = start + file.bytes.length;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  assert.equal(view.getUint32(footer + 16, true), offset);
});
