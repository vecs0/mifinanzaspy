const KEY_A = 'a'.repeat(64);
const KEY_B = 'b'.repeat(64);

type Enc = typeof import('@/services/encryption');

async function cargar(keyHex?: string): Promise<Enc> {
  jest.resetModules();
  if (keyHex) {
    const store = require('expo-secure-store');
    await store.setItemAsync('db_encryption_key', keyHex);
  }
  return require('@/services/encryption');
}

describe('encryption', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('roundtrip texto simple y con unicode', async () => {
    const { encrypt, decrypt } = await cargar(KEY_A);
    for (const txt of ['hola', 'Gs. 1.500.000 — ñandú 日本', 'x'.repeat(5000)]) {
      const c = await encrypt(txt);
      expect(c!.startsWith('v2:')).toBe(true);
      expect(c).not.toContain(txt);
      await expect(decrypt(c)).resolves.toBe(txt);
    }
  });

  it('null y vacio pasan sin cifrar', async () => {
    const { encrypt, decrypt } = await cargar(KEY_A);
    await expect(encrypt(null)).resolves.toBeNull();
    await expect(encrypt('')).resolves.toBe('');
    await expect(decrypt(null)).resolves.toBeNull();
  });

  it('nonce aleatorio: mismo texto produce distinto ciphertext', async () => {
    const { encrypt } = await cargar(KEY_A);
    expect(await encrypt('igual')).not.toBe(await encrypt('igual'));
  });

  it('clave incorrecta no descifra', async () => {
    const a = await cargar(KEY_A);
    const c = await a.encrypt('secreto');
    const b = await cargar(KEY_B);
    await expect(b.decrypt(c)).rejects.toThrow('Decryption failed');
  });

  it('ciphertext alterado es detectado', async () => {
    const { encrypt, decrypt } = await cargar(KEY_A);
    const c = (await encrypt('secreto de prueba'))!;
    const raw = Buffer.from(c.slice(3), 'base64');
    raw[raw.length - 1] ^= 0x01;
    const tampered = 'v2:' + raw.toString('base64');
    await expect(decrypt(tampered)).rejects.toThrow('Decryption failed');
    raw[raw.length - 1] ^= 0x01;
    raw[30] ^= 0xff;
    await expect(decrypt('v2:' + raw.toString('base64'))).rejects.toThrow('Decryption failed');
  });

  it('nonce alterado es detectado', async () => {
    const { encrypt, decrypt } = await cargar(KEY_A);
    const c = (await encrypt('secreto'))!;
    const raw = Buffer.from(c.slice(3), 'base64');
    raw[0] ^= 0xff;
    await expect(decrypt('v2:' + raw.toString('base64'))).rejects.toThrow('Decryption failed');
  });

  it('payload v2 truncado lanza error', async () => {
    const { decrypt } = await cargar(KEY_A);
    await expect(decrypt('v2:AAAA')).rejects.toThrow();
  });

  it('genera y persiste una clave si no existe', async () => {
    const { encrypt } = await cargar();
    await encrypt('x');
    const store = require('expo-secure-store');
    const key = await store.getItemAsync('db_encryption_key');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
  });
});