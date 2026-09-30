/**
 * encryption
 * Responsabilidad: Cifrado/descifrado autenticado con retrocompatibilidad XOR
 * Usado por: database
 * Depende de: expo-secure-store, expo-crypto, tweetnacl
 */
import { getRandomBytesAsync } from 'expo-crypto';
import nacl from 'tweetnacl';

const KEY_STORE = 'db_encryption_key';
const V2_PREFIX = 'v2:';
const NONCE_LENGTH = 24;
const KEY_LENGTH = 32;

async function getOrCreateKey(): Promise<string> {
  let SecureStore: any;
  try {
    SecureStore = require('expo-secure-store');
  } catch {
    throw new Error('SecureStore no disponible');
  }
  let key = await SecureStore.getItemAsync(KEY_STORE);
  if (!key) {
    const random = await getRandomBytesAsync(32);
    key = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
    await SecureStore.setItemAsync(KEY_STORE, key);
  }
  return key;
}

function b64(buf: Uint8Array): string {
  let s = '';
  for (const b of buf) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(str: string): Uint8Array {
  const s = atob(str);
  const buf = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i);
  return buf;
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

let keyCache: string | null = null;

async function getKey(): Promise<string> {
  if (!keyCache) keyCache = await getOrCreateKey();
  return keyCache;
}

function xorEncode(text: string, key: string): string {
  const bytes = new TextEncoder().encode(text);
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return btoa(String.fromCharCode(...result));
}

function xorDecode(encoded: string, key: string): string {
  const bytes = new Uint8Array(atob(encoded).split('').map(c => c.charCodeAt(0)));
  const keyBytes = new TextEncoder().encode(key);
  const result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    result[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return new TextDecoder().decode(result);
}

function aesEncode(text: string, keyHex: string): string {
  const key = hexToUint8Array(keyHex);
  const nonce = nacl.randomBytes(NONCE_LENGTH);
  const data = new TextEncoder().encode(text);
  const encrypted = nacl.secretbox(data, nonce, key);
  if (!encrypted) throw new Error('Encryption failed');
  const combined = new Uint8Array(NONCE_LENGTH + encrypted.length);
  combined.set(nonce, 0);
  combined.set(encrypted, NONCE_LENGTH);
  return b64(combined);
}

function aesDecode(encoded: string, keyHex: string): string {
  const key = hexToUint8Array(keyHex);
  const combined = unb64(encoded);
  const nonce = combined.slice(0, NONCE_LENGTH);
  const ciphertext = combined.slice(NONCE_LENGTH);
  const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
  if (!decrypted) throw new Error('Decryption failed — key or data corrupted');
  return new TextDecoder().decode(decrypted);
}

export async function encrypt(text: string | null): Promise<string | null> {
  if (!text) return text;
  const key = await getKey();
  try {
    return V2_PREFIX + aesEncode(text, key);
  } catch (e) {
    console.warn('[Encryption] AES encrypt failed, falling back:', e);
    return xorEncode(text, key);
  }
}

export async function decrypt(encoded: string | null): Promise<string | null> {
  if (!encoded) return encoded;
  const key = await getKey();
  if (encoded.startsWith(V2_PREFIX)) {
    try {
      return aesDecode(encoded.slice(V2_PREFIX.length), key);
    } catch (e) {
      console.warn('[Encryption] AES decrypt failed:', e);
      return null;
    }
  }
  try {
    return xorDecode(encoded, key);
  } catch {
    return encoded;
  }
}
