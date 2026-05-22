const TIKZ_COMPILE_URL = process.env.TIKZ_COMPILE_URL;

if (!TIKZ_COMPILE_URL && process.env.NODE_ENV === 'production') {
  console.warn('[TikZ Compile] TIKZ_COMPILE_URL env var not set');
}

export interface TikzCompileResult {
  svg: string;
  cached: boolean;
  compile_time_ms: number;
}

export interface TikzCompileError {
  error: string;
  details?: string;
}

/**
 * Compile TikZ code to SVG via Railway service.
 * @throws Error if compilation fails or URL not configured
 */
export async function compileTikz(latex: string): Promise<TikzCompileResult> {
  if (!TIKZ_COMPILE_URL) {
    throw new Error('TIKZ_COMPILE_URL not configured');
  }

  if (!latex || typeof latex !== 'string') {
    throw new Error('Latex code is required');
  }

  if (latex.length > 50000) {
    throw new Error('Latex code too long (max 50000 chars)');
  }

  const response = await fetch(`${TIKZ_COMPILE_URL}/compile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ latex }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText })) as TikzCompileError;
    throw new Error(`TikZ compile failed: ${errorData.error}`);
  }

  return response.json() as Promise<TikzCompileResult>;
}

/**
 * Check if TikZ compile service is healthy.
 */
export async function checkTikzServiceHealth(): Promise<boolean> {
  if (!TIKZ_COMPILE_URL) return false;
  try {
    const response = await fetch(`${TIKZ_COMPILE_URL}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
