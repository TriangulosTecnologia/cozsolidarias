import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Dev-only sink for the `/mapas` playground: writes the geovis
 * `VisualizationSpec` produced by the client runtime (post-`buildSpec`,
 * post-boundary-toggle, post-overlay-lift) to disk, one file per {@link MapMode}.
 *
 * Not part of the app's data contract — no gateway call, no production use.
 * Disabled outside development so a spec never gets written to a deployed
 * filesystem.
 *
 * @param request - Body: `{ mode: string; spec: unknown }`.
 * @returns 204 on write, 404 outside development, 400 on a malformed body.
 *
 * @example
 * fetch('/api/dev/mapa-spec-dump', {
 *   method: 'POST',
 *   body: JSON.stringify({ mode: 'coropletico', spec }),
 * });
 */
export const POST = async (request: NextRequest) => {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = (await request.json()) as { mode?: unknown; spec?: unknown };

  if (
    typeof body.mode !== 'string' ||
    !/^[a-z0-9-]+$/.test(body.mode) ||
    body.spec === undefined
  ) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const dir = path.join(
    process.cwd(),
    'src/app/(features)/mapas/specs/runtime-captured'
  );

  await mkdir(dir, { recursive: true });
  await writeFile(
    path.join(dir, `${body.mode}.json`),
    JSON.stringify(body.spec, null, 2)
  );

  return new NextResponse(null, { status: 204 });
};
