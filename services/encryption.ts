/**
 * encryption
 * Responsabilidad: Cifrado/descifrado autenticado con tweetnacl (XSalsa20-Poly1305)
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
  let key: string | null = null;
  try {
    key = await SecureStore.getItemAsync(KEY_STORE);
  } catch (e) {
    throw new Error('No se pudo leer la clave de SecureStore');
  }
  if (key && !/^[0-9a-f]{64}$/i.test(key)) key = null;
  if (!key) {
    const random = await getRandomBytesAsync(KEY_LENGTH);
    key = Array.from(random).map(b => b.toString(16).padStart(2, '0')).join('');
    try {
      await SecureStore.setItemAsync(KEY_STORE, key);
    } catch (e) {
      throw new Error('No se pudo guardar la clave en SecureStore');
    }
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

let keyPromise: Promise<string> | null = null;
let claveHexCache: string | null = null;

function getKey(): Promise<string> {
  if (!keyPromise) {
    keyPromise = getOrCreateKey()
      .then(key => {
        claveHexCache = key;
        return key;
      })
      .catch(e => {
        keyPromise = null;
        claveHexCache = null;
        throw e;
      });
  }
  return keyPromise;
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

function tieneBasura(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 0xfffd || (c < 32 && c !== 9 && c !== 10 && c !== 13)) return true;
  }
  return false;
}

function decodeLegacy(encoded: string, keyHex: string): string {
  try {
    const bytes = unb64(encoded);
    const keyBytes = new TextEncoder().encode(keyHex);
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
    const text = new TextDecoder('utf-8', { fatal: true }).decode(out);
    return tieneBasura(text) ? encoded : text;
  } catch {
    return encoded;
  }
}

export async function encrypt(text: string | null): Promise<string | null> {
  if (!text) return text;
  const key = await getKey();
  return V2_PREFIX + aesEncode(text, key);
}

export async function decrypt(encoded: string | null): Promise<string | null> {
  if (!encoded) return encoded;
  const key = await getKey();
  if (encoded.startsWith(V2_PREFIX)) {
    return aesDecode(encoded.slice(V2_PREFIX.length), key);
  }
  return decodeLegacy(encoded, key);
}

export async function precargarClave(): Promise<void> {
  await getKey();
}

export function encriptarCampo(text: string | null): string | null {
  if (!text) return text;
  if (!claveHexCache) throw new Error('Clave no precargada');
  return V2_PREFIX + aesEncode(text, claveHexCache);
}

export function desencriptarCampo(encoded: string | null): string | null {
  if (!encoded) return encoded;
  if (!encoded.startsWith(V2_PREFIX)) return encoded;
  if (!claveHexCache) throw new Error('Clave no precargada');
  return aesDecode(encoded.slice(V2_PREFIX.length), claveHexCache);
}
