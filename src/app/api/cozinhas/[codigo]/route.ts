import { gateway } from '../../../../gateway';

/**
 * Returns the full detail of a single cozinha by its registration code
 * (`Código da Cozinha`) within a snapshot year (`?ano=YYYY`, defaulting to the
 * latest), e.g. `GET /api/cozinhas/CS016282?ano=2025`. Responds `404` when that
 * year's snapshot has no cozinha with the code.
 *
 * The `codigo` segment is the same value the map exposes as a point feature's
 * `id` (`promoteId: 'codigo'`), so a click can request it directly. The caller
 * must pass the year it is displaying: the snapshots cover different
 * populations, so a código plotted for one year is often absent from another.
 */
export const GET = async (
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) => {
  const { codigo } = await params;
  const ano = new URL(request.url).searchParams.get('ano');
  const cozinha = await gateway.getCozinhaByCodigo(
    codigo,
    ano ? Number(ano) : undefined
  );

  if (!cozinha) {
    return Response.json(
      { error: `Cozinha não encontrada: ${codigo}` },
      { status: 404 }
    );
  }

  return Response.json(cozinha);
};
