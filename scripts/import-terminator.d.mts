export function extractTerminator(source: string): string;
export function instrumentTerminator(
  source: string,
  project: unknown,
  bundle: string,
): string;
export function importTerminator(sourcePath: string): Promise<void>;
