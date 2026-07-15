import { gateway } from '../../../../gateway';

/**
 * Returns the full detail of a single cozinha by its registration code
 * (`Código da Cozinha`), e.g. `GET /api/cozinhas/CS016282`. Responds `404` when
 * no cozinha carries the code.
 *
 * The `codigo` segment is the same value the map exposes as a point feature's
 * `id` (`promoteId: 'codigo'`), so a click can request it directly.
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) => {
  const { codigo } = await params;
  const cozinha = await gateway.getCozinhaByCodigo(codigo);

  if (!cozinha) {
    return Response.json(
      { error: `Cozinha não encontrada: ${codigo}` },
      { status: 404 }
    );
  }

  return Response.json(cozinha);
};
