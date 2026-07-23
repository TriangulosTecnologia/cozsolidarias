import { gateway } from '../../../../gateway';

/**
 * Returns production and income data for a single CAF by its registration
 * number. Responds with 404 when no production records exist for that `nrCaf`
 * (the CAF has a map location but no production data in the snapshot).
 */
export const GET = async (
  _request: Request,
  { params }: { params: Promise<{ nrCaf: string }> }
) => {
  const { nrCaf } = await params;
  const detalhe = await gateway.getCafByNrCaf(nrCaf);

  if (!detalhe) {
    return Response.json(
      { error: `CAF não encontrado: ${nrCaf}` },
      { status: 404 }
    );
  }

  return Response.json(detalhe);
};
