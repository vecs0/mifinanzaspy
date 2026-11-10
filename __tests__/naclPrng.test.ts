jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    getRandomBytes: jest.fn((n: number) => new Uint8Array(nodeCrypto.randomBytes(n))),
    getRandomBytesAsync: jest.fn(async (n: number) => new Uint8Array(nodeCrypto.randomBytes(n))),
  };
});

jest.mock('tweetnacl', () => {
  const actual = jest.requireActual('tweetnacl');
  const real = actual.default || actual;
  let registrado = false;
  const envuelto = {
    ...real,
    setPRNG: (fn: (x: Uint8Array, n: number) => void) => {
      registrado = true;
      real.setPRNG(fn);
    },
    randomBytes: (n: number) => {
      if (!registrado) throw new Error('no PRNG');
      return real.randomBytes(n);
    },
  };
  return { __esModule: true, default: envuelto };
});

const KEY_A = 'a'.repeat(64);
const cryptoOriginal = Object.getOwnPropertyDescriptor(globalThis, 'crypto');

function setCryptoGlobal(value: unknown): void {
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true, writable: true });
}

describe('naclPrng', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (cryptoOriginal) Object.defineProperty(globalThis, 'crypto', cryptoOriginal);
    else delete (globalThis as { crypto?: unknown }).crypto;
    jest.restoreAllMocks();
  });

  it('sin registración nacl.randomBytes lanza no PRNG', () => {
    const nacl = require('tweetnacl').default;
    expect(() => nacl.randomBytes(24)).toThrow('no PRNG');
  });

  it('registrarPRNGNacl habilita randomBytes desde expo-crypto.getRandomBytes', () => {
    const { registrarPRNGNacl } = require('@/services/naclPrng');
    const cryptoMock = require('expo-crypto');
    registrarPRNGNacl();
    const bytes = require('tweetnacl').default.randomBytes(4);
    expect(cryptoMock.getRandomBytes).toHaveBeenCalledWith(4);
    expect(bytes).toHaveLength(4);
  });

  it('los bytes entregados provienen de expo-crypto.getRandomBytes', () => {
    const { registrarPRNGNacl } = require('@/services/naclPrng');
    const cryptoMock = require('expo-crypto');
    cryptoMock.getRandomBytes.mockReturnValueOnce(new Uint8Array([1, 2, 3, 4]));
    registrarPRNGNacl();
    const bytes = require('tweetnacl').default.randomBytes(4);
    expect(Array.from(bytes)).toEqual([1, 2, 3, 4]);
  });

  it('es idempotente: registrar dos veces deja un solo setPRNG', () => {
    const { registrarPRNGNacl } = require('@/services/naclPrng');
    const nacl = require('tweetnacl').default;
    const spy = jest.spyOn(nacl, 'setPRNG');
    registrarPRNGNacl();
    registrarPRNGNacl();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cae a globalThis.crypto.getRandomValues si getRandomBytes lanza', () => {
    const cryptoMock = require('expo-crypto');
    cryptoMock.getRandomBytes.mockImplementation(() => {
      throw new Error('modulo nativo no disponible');
    });
    const getRandomValues = jest.fn((arr: Uint8Array) => {
      arr.fill(9);
      return arr;
    });
    setCryptoGlobal({ getRandomValues });
    const { registrarPRNGNacl } = require('@/services/naclPrng');
    registrarPRNGNacl();
    const bytes = require('tweetnacl').default.randomBytes(6);
    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(Array.from(bytes)).toEqual([9, 9, 9, 9, 9, 9]);
  });

  it('lanza PRNG no disponible si no hay ninguna fuente', () => {
    const cryptoMock = require('expo-crypto');
    cryptoMock.getRandomBytes.mockImplementation(() => {
      throw new Error('modulo nativo no disponible');
    });
    setCryptoGlobal(undefined);
    const { registrarPRNGNacl } = require('@/services/naclPrng');
    registrarPRNGNacl();
    expect(() => require('tweetnacl').default.randomBytes(4)).toThrow('PRNG no disponible');
  });

  it('encryption registra el PRNG al cargarse y cifra sin crypto global', async () => {
    setCryptoGlobal(undefined);
    const store = require('expo-secure-store');
    await store.setItemAsync('db_encryption_key', KEY_A);
    const cryptoMock = require('expo-crypto');
    const enc: typeof import('@/services/encryption') = require('@/services/encryption');
    await enc.precargarClave();
    const cifrado = enc.encriptarCampo('mensaje sensible del chat');
    expect(cifrado!.startsWith('v2:')).toBe(true);
    expect(cryptoMock.getRandomBytes).toHaveBeenCalledWith(24);
    expect(enc.desencriptarCampo(cifrado)).toBe('mensaje sensible del chat');
    const asincrono = await enc.encrypt('otro mensaje');
    await expect(enc.decrypt(asincrono)).resolves.toBe('otro mensaje');
  });
});
