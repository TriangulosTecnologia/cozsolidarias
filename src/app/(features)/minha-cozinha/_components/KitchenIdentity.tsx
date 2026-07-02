import { Badge, Box, Stack, Text } from '@chakra-ui/react';

import type { NearbyKitchen } from '@/data-gateway/schema';

type KitchenIdentityProps = {
  kitchen: NearbyKitchen;
};

/**
 * Identity summary of the selected kitchen (status, location, operation and
 * public served), from the source CSV fields carried on {@link NearbyKitchen}.
 * Empty source fields are skipped.
 *
 * @example
 * <KitchenIdentity kitchen={selected} />
 */
const KitchenIdentity = ({ kitchen }: KitchenIdentityProps) => {
  const location = [kitchen.bairro, `${kitchen.municipio} — ${kitchen.uf}`]
    .filter(Boolean)
    .join(' · ');

  const operation = kitchen.emFuncionamento
    ? `Em funcionamento: ${kitchen.emFuncionamento}${
        kitchen.diasFuncionamento
          ? ` · ${kitchen.diasFuncionamento} dia(s)/semana`
          : ''
      }`
    : '';

  return (
    <Stack gap={2} mb={4}>
      {kitchen.situacao ? (
        <Box>
          <Badge colorPalette="green" variant="surface">
            {kitchen.situacao}
          </Badge>
        </Box>
      ) : null}
      <Text textStyle="body-sm" color="text.secondary">
        {location}
      </Text>
      {kitchen.endereco ? (
        <Text textStyle="caption" color="text.secondary">
          {kitchen.endereco}
        </Text>
      ) : null}
      {operation ? (
        <Text textStyle="caption" color="text.secondary">
          {operation}
        </Text>
      ) : null}
      {kitchen.publicoTotalAtendido ? (
        <Text textStyle="caption" color="text.secondary">
          Público total atendido: {kitchen.publicoTotalAtendido}
        </Text>
      ) : null}
      {kitchen.publicoAtendido ? (
        <Text textStyle="caption" color="text.secondary">
          {kitchen.publicoAtendido}
        </Text>
      ) : null}
    </Stack>
  );
};

export default KitchenIdentity;
