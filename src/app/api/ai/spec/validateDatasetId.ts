import {
  isRenderableDatasetId,
  type RenderableDatasetId,
} from './mapDataCatalogue';
import { errorResponse, unsupportedDatasetMessage } from './specValidation';

/**
 * Reads the optional `datasetId` of a request body — the dataset the user
 * picked when asked to disambiguate.
 *
 * @param rawBody - A body whose `prompt` already validated, so it is an object.
 * @returns The chosen {@link RenderableDatasetId}, `undefined` when none was
 * sent, or the 400 `Response` for a dataset the route cannot render.
 *
 * @example
 * validateDatasetId({ prompt: 'mapa', datasetId: 'municipios_ivs' }); // 'municipios_ivs'
 */
export const validateDatasetId = (
  rawBody: object
): RenderableDatasetId | undefined | Response => {
  const rawDatasetId = 'datasetId' in rawBody ? rawBody.datasetId : undefined;
  if (rawDatasetId === undefined) {
    return undefined;
  }
  if (!isRenderableDatasetId(rawDatasetId)) {
    return errorResponse({
      status: 400,
      message:
        typeof rawDatasetId === 'string'
          ? `Campo "datasetId": ${unsupportedDatasetMessage(rawDatasetId)}`
          : 'Campo "datasetId": esperado o texto de um dataset disponível.',
    });
  }
  return rawDatasetId;
};
