/**
 * naclPrng
 * Responsabilidad: registrar nacl.setPRNG con expo-crypto para que nacl.randomBytes funcione en React Native
 * Usado por: encryption
 * Depende de: expo-crypto, tweetnacl
 */
import { getRandomBytes } from 'expo-crypto';
import nacl from 'tweetnacl';

type CryptoGlobal = { getRandomValues?: (arr: Uint8Array) => Uint8Array };

let registrado = false;

export function registrarPRNGNacl(): void {
  if (registrado) return;
  nacl.setPRNG((x: Uint8Array, n: number) => {
    let bytes: Uint8Array | null = null;
    try {
      bytes = getRandomBytes(n);
    } catch {
      bytes = null;
    }
    if (bytes && bytes.length >= n) {
      x.set(bytes.subarray(0, n));
      return;
    }
    const cryptoGlobal = (globalThis as { crypto?: CryptoGlobal }).crypto;
    if (cryptoGlobal && typeof cryptoGlobal.getRandomValues === 'function') {
      const alternativa = new Uint8Array(n);
      cryptoGlobal.getRandomValues(alternativa);
      x.set(alternativa);
      return;
    }
    throw new Error('PRNG no disponible');
  });
  registrado = true;
}
