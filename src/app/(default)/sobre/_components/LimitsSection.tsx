import { Box, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

const STATEMENTS = [
  'Não transformamos lacunas em certezas.',
  'Não exibimos número sem fonte.',
  'Não tratamos mapa como realidade completa.',
  'Não usamos imagens de vulnerabilidade como estética.',
  'Não confundimos tecnologia com neutralidade.',
];
/**
 * LimitsSection — high-contrast dark section declaring methodological limits.
 * Statements rendered in large type; body text closes the section.
 *
 * @example
 * <LimitsSection />
 */
const LimitsSection = () => {
  return (
    <Box
      as="section"
      py="clamp(4rem, calc(3rem + 4vw), 8rem)"
      bg="charcoal.900"
      aria-labelledby="limits-heading"
    >
      <Container>
        <Stack gap="clamp(2.5rem, calc(2rem + 2vw), 5rem)">
          {/* Heading block */}
          <Box>
            <Text textStyle="eyebrow" color="verde.300" mb={5}>
              Limites
            </Text>
            <Text
              as="h2"
              id="limits-heading"
              textStyle="title-2"
              color="ivory.100"
              maxW="24ch"
            >
              Clareza também é dizer limite.
            </Text>
          </Box>

          {/* Large-type statements list */}
          <Stack gap={0} borderTop="1px solid" borderColor="charcoal.700">
            {STATEMENTS.map((statement) => {
              return (
                <Box
                  key={statement}
                  py="clamp(1rem, calc(0.75rem + 1vw), 1.5rem)"
                  borderBottom="1px solid"
                  borderColor="charcoal.700"
                >
                  <Text textStyle="title-3" color="ivory.200">
                    {statement}
                  </Text>
                </Box>
              );
            })}
          </Stack>

          {/* Explanatory body */}
          <Text textStyle="body-lg" color="ivory.300" maxW="60ch">
            Quando um dado não está identificado, ele deve permanecer visível
            como lacuna. Quando uma localização é sensível ou imprecisa, ela
            deve ser tratada com cuidado. Quando uma fonte é parcial, sua
            cobertura deve aparecer.
          </Text>
        </Stack>
      </Container>
    </Box>
  );
};

export default LimitsSection;
