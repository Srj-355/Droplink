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
 * NOTE: writer.write() must receive a Uint8Array (not a raw ArrayBuffer)
 * and must be awaited before close(), otherwise the stream closes empty
 * and callers see 0-byte on-wire sizes.
 */
export async function compressChunk(buffer) {
  const input = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0);
  if (input.byteLength === 0) return new ArrayBuffer(0);
  const cs = new CompressionStream('deflate-raw');
  const outPromise = new Response(cs.readable).arrayBuffer();
  const writer = cs.writable.getWriter();
  try {
    await writer.write(input);
    await writer.close();
  } catch (e) {
    try { writer.releaseLock(); } catch { /* ignore */ }
    throw e;
  }
  const out = await outPromise;
  if (!out || out.byteLength === 0) {
    throw new Error('Compression produced empty output');
  }
  return out;
}

/**
 * Decompressess an ArrayBuffer using deflate-raw.
 */
export async function decompressChunk(buffer) {
  const input = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer || 0);
  if (input.byteLength === 0) return new ArrayBuffer(0);
  const ds = new DecompressionStream('deflate-raw');
  const outPromise = new Response(ds.readable).arrayBuffer();
  const writer = ds.writable.getWriter();
  try {
    await writer.write(input);
    await writer.close();
  } catch (e) {
    try { writer.releaseLock(); } catch { /* ignore */ }
    throw e;
  }
  const out = await outPromise;
  if (!out || out.byteLength === 0) {
    throw new Error('Decompression produced empty output');
  }
  return out;
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
