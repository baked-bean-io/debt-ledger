const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function mintId(existing: Set<string>, random: () => number = Math.random): string {
  for (;;) {
    let suffix = '';
    for (let i = 0; i < 4; i++) {
      suffix += ALPHABET[Math.floor(random() * ALPHABET.length)];
    }
    const id = `td-${suffix}`;
    if (!existing.has(id)) return id;
  }
}
