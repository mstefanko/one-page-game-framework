export function rng(seed: number) { return (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0; }
