export async function hashPassword(password, salt) {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function isHashed(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

export async function verificarSenha(password, salt, stored) {
  if (!stored) return false;
  if (isHashed(stored)) {
    const h = await hashPassword(password, salt);
    return h === stored;
  }
  return password === stored;
}

export async function garantirHash(senha, salt) {
  if (isHashed(senha)) return senha;
  return hashPassword(senha, salt);
}
