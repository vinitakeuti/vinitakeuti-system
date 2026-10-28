/** Números pseudoaleatórios com semente fixa: o mesmo desenho no servidor e no navegador. */
export function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}
