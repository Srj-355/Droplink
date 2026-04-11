/**
 * Compression utility for Droplink using native browser APIs.
 * Uses deflate-raw for maximum speed and zero framing overhead.
 */

export const COMPRESSION_RATIO_THRESHOLD = 0.90;

export const SKIP_COMPRESSION_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/', 'audio/',
  'application/zip', 'application/x-rar', 'application/x-7z',
  'application/gzip', 'application/x-bzip2', 'application/zstd',
  'application/pdf'
];

/**
 * Checks if the browser supports CompressionStream/DecompressionStream.
 */
export function isCompressionSupported() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

/**
 * Checks if a file should be compressed based on its MIME type.
 */
export function shouldCompressFile(file) {
  if (!file.type) return true;
  return !SKIP_COMPRESSION_TYPES.some(type => file.type.toLowerCase().startsWith(type.toLowerCase()));
}

/**
 * Compresses an ArrayBuffer using deflate-raw.
 */
export async function compressChunk(buffer) {
  const cs = new CompressionStream('deflate-raw');
  const writer = cs.writable.getWriter();
  writer.write(buffer);
  writer.close();
  const reader = cs.readable.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const result = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result.buffer;
}

/**
 * Decompresses an ArrayBuffer using deflate-raw.
 */
export async function decompressChunk(buffer) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(buffer);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const result = new Uint8Array(chunks.reduce((acc, c) => acc + c.length, 0));
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result.buffer;
}

/**
 * Tests the first chunk to see if it's worth compressing.
 * Returns true if the ratio is below the threshold.
 */
export async function testCompressionRatio(rawBuffer) {
  if (rawBuffer.byteLength < 1024) return false; // Don't bother with tiny chunks
  const compressed = await compressChunk(rawBuffer);
  const ratio = compressed.byteLength / rawBuffer.byteLength;
  return {
    shouldCompress: ratio < COMPRESSION_RATIO_THRESHOLD,
    ratio,
    compressedBuffer: compressed
  };
}
