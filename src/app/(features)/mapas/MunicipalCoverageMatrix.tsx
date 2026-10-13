import { Box, Stack, Text } from '@chakra-ui/react';

import { BIVARIATE_COLORS } from './municipalKitchenCoverage';

const MunicipalCoverageMatrix = ({ cuts }: { cuts: number[] }) => {
  return (
    <Stack gap="1">
      <Text fontSize="xs">Risco CADINSAN ↑ · Tm →</Text>
      <Box
        display="grid"
        gridTemplateColumns="repeat(3, 1fr)"
        gap="1"
        role="img"
        aria-label="Matriz de nove cores: risco aumenta para cima; proporção habilitada aumenta para a direita"
      >
        {[6, 7, 8, 3, 4, 5, 0, 1, 2].map((i) => {
          return <Box key={i} bg={BIVARIATE_COLORS[i]} height="22px" />;
        })}
      </Box>
      <Text fontSize="xs">Tm: &lt; 33,33% · 33,33–66,67% · ≥ 66,67%.</Text>
      <Text fontSize="xs">
        Risco: cortes conjuntos em{' '}
        {cuts
          .map((n) => {
            return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
          })
          .join(' e ')}
        . As faixas são relativas, sem graus de severidade.
      </Text>
      <Text fontSize="xs">
        Branco: sem cozinha cadastrada. Cinza: cozinha cadastrada sem CADINSAN.
        Cinza escuro: sem dados. Bases pequenas estão identificadas no tooltip.
      </Text>
    </Stack>
  );
};

export default MunicipalCoverageMatrix;
