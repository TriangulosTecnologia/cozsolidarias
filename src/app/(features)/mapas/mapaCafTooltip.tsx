import { Box, Text } from '@chakra-ui/react';
import type * as React from 'react';

import type { CafAreaProperties } from '@/data-gateway/schema';

/** Green accent used across CAF tooltip elements. */
const CAF_GREEN = '#2D9B52';

/**
 * Tooltip shown when hovering a CAF area point on the map. Renders a custom
 * layout with a green left-border accent, prominent area size, location details
 * and an "Imóvel principal" badge when applicable.
 *
 * @param props - All {@link CafAreaProperties} fields from the hovered feature.
 * @returns The tooltip element for the hovered CAF point.
 *
 * @example
 * renderCafTooltip({ nrCaf: '6', dsTipoArea: 'Terra', nrArea: 2.2, dsTipoUnidadeMedida: 'ha', nmMunicipio: 'Brasília', sgUf: 'DF', dsTipoLocalizacaoArea: 'Rural', dsCondicaoDominio: 'Proprietário', stImovelPrincipal: 'true' });
 */
export const renderCafTooltip = (props: CafAreaProperties): React.ReactNode => {
  const area = props.nrArea.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
  });
  const isMain = props.stImovelPrincipal === 'true';

  return (
    <Box minW="210px" maxW="250px">
      {/* Header: green accent + CAF id + area destaque */}
      <Box borderLeft="3px solid" borderLeftColor={CAF_GREEN} pl="2.5" mb="2">
        <Text fontSize="xs" color="text.secondary" lineHeight="tight" mb="0.5">
          CAF {props.nrCaf}
        </Text>
        <Text fontSize="sm" fontWeight="bold" lineHeight="tight">
          {area}{' '}
          {props.dsTipoUnidadeMedida === 'ha'
            ? 'hectares'
            : props.dsTipoUnidadeMedida}{' '}
          de {props.dsTipoArea.toLowerCase()}
        </Text>
      </Box>

      {/* Divider */}
      <Box h="1px" bg="ivory.300" mb="2" />

      {/* Location + type details */}
      <Box display="flex" flexDirection="column" gap="1">
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {props.dsTipoLocalizacaoArea} · {props.dsCondicaoDominio}
        </Text>
        {isMain && (
          <Box
            display="inline-flex"
            alignSelf="flex-start"
            px="1.5"
            py="0.5"
            mt="0.5"
            borderRadius="full"
            borderWidth="1px"
            borderColor={CAF_GREEN}
          >
            <Text
              fontSize="xs"
              fontWeight="medium"
              lineHeight="tight"
              color={CAF_GREEN}
            >
              Imóvel principal
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  );
};
