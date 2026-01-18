import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Pure JavaScript SHA-256 implementation
 * Used as fallback when crypto.subtle is not available (non-secure contexts)
 * Based on the FIPS 180-4 standard
 */
function sha256JS(message: string): string {
  // Helper functions
  const rightRotate = (value: number, amount: number) => 
    (value >>> amount) | (value << (32 - amount));
  
  // Initial hash values (first 32 bits of fractional parts of square roots of first 8 primes)
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ]);
  
  // Round constants (first 32 bits of fractional parts of cube roots of first 64 primes)
  const k = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);
  
  // Convert string to UTF-8 bytes
  const encoder = new TextEncoder();
  const messageBytes = encoder.encode(message);
  const bitLength = messageBytes.length * 8;
  
  // Pre-processing: adding padding bits
  // Message + 1 bit + padding + 64-bit length
  const paddingLength = (64 - ((messageBytes.length + 9) % 64)) % 64;
  const paddedLength = messageBytes.length + 1 + paddingLength + 8;
  const padded = new Uint8Array(paddedLength);
  padded.set(messageBytes);
  padded[messageBytes.length] = 0x80; // Append bit '1'
  
  // Append length in bits as 64-bit big-endian
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 4, bitLength, false); // Big-endian
  
  // Process message in 512-bit (64-byte) chunks
  const w = new Uint32Array(64);
  
  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    // Copy chunk into first 16 words
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunkStart + i * 4, false);
    }
    
    // Extend the first 16 words into the remaining 48 words
    for (let i = 16; i < 64; i++) {
      const s0 = rightRotate(w[i-15], 7) ^ rightRotate(w[i-15], 18) ^ (w[i-15] >>> 3);
      const s1 = rightRotate(w[i-2], 17) ^ rightRotate(w[i-2], 19) ^ (w[i-2] >>> 10);
      w[i] = (w[i-16] + s0 + w[i-7] + s1) >>> 0;
    }
    
    // Initialize working variables
    let a = h[0], b = h[1], c = h[2], d = h[3];
    let e = h[4], f = h[5], g = h[6], hh = h[7];
    
    // Compression function main loop
    for (let i = 0; i < 64; i++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ ((~e) & g);
      const temp1 = (hh + S1 + ch + k[i] + w[i]) >>> 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      
      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }
    
    // Add compressed chunk to hash value
    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }
  
  // Produce final hash value (big-endian)
  return Array.from(h)
    .map(n => n.toString(16).padStart(8, '0'))
    .join('');
}

/**
 * Check if Web Crypto API is available (only in secure contexts)
 */
function isCryptoSubtleAvailable(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' && 
         typeof crypto.subtle.digest === 'function';
}

/**
 * Hash an auth code using SHA-256
 * Uses native crypto.subtle when available (HTTPS/localhost)
 * Falls back to pure JS implementation on HTTP
 * 
 * Both produce identical SHA-256 hashes for compatibility
 */
export async function hashAuthCode(code: string): Promise<string> {
  // Check if crypto.subtle is available (secure context)
  if (isCryptoSubtleAvailable()) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(code);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      return hashHex;
    } catch (error) {
      console.warn("[hashAuthCode] crypto.subtle.digest failed, using JS fallback:", error);
      return sha256JS(code);
    }
  }
  
  // Fallback for non-secure contexts (HTTP) - uses pure JS SHA-256
  console.warn("[hashAuthCode] crypto.subtle not available (non-secure context), using JS SHA-256");
  return sha256JS(code);
}
