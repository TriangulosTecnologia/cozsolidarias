'use client';

import { Box, Grid, Text } from '@chakra-ui/react';
import * as React from 'react';

import Container from '../../../components/ui/Container';

type Principle = {
  verb: string;
  description: string;
  meta: string;
};

const PRINCIPLES: Principle[] = [
  {
    verb: 'Mapeamos.',
    description: 'Registros territoriais de cozinhas, entidades e fontes.',
    meta: 'Fonte · Cobertura · Status · Limite',
  },
  {
    verb: 'Validamos.',
    description: 'Origem, cobertura, consistência e status dos dados.',
    meta: 'Fonte · Cobertura · Status · Limite',
  },
  {
    verb: 'Visualizamos.',
    description: 'Mapas, filtros e recortes para leitura pública.',
    meta: 'Fonte · Cobertura · Status · Limite',
  },
  {
    verb: 'Devolvemos.',
    description: 'Informação útil para territórios, redes e políticas.',
    meta: 'Fonte · Cobertura · Status · Limite',
  },
];

type CardProps = {
  principle: Principle;
};

const PrincipleCard = ({ principle }: CardProps) => {
  const [hovered, setHovered] = React.useState(false);

  return (
    <Box
      p={8}
      bg="ivory.50"
      borderRadius="card"
      cursor="default"
      boxShadow={hovered ? 'card' : 'none'}
      transition="box-shadow 0.3s ease-out"
      onMouseEnter={() => {
        return setHovered(true);
      }}
      onMouseLeave={() => {
        return setHovered(false);
      }}
    >
      <Box
        transform={hovered ? 'translateY(-2px)' : 'none'}
        transition="transform 0.3s ease-out"
      >
        <Text textStyle="title-3" color="charcoal.900" mb={4}>
          {principle.verb}
        </Text>
        <Text textStyle="body-sm" color="charcoal.700" mb={4}>
          {principle.description}
        </Text>
        <Text
          textStyle="caption"
          color="verde.600"
          opacity={hovered ? 1 : 0}
          transform={hovered ? 'none' : 'translateY(4px)'}
          transition="opacity 0.3s ease-out, transform 0.3s ease-out"
        >
          {principle.meta}
        </Text>
      </Box>
    </Box>
  );
};

/**
 * OperatingPrinciples — four method verbs as cards.
 * Staggered fade-in on scroll via IntersectionObserver.
 * Hover reveals metadata line and lifts card 2px.
 *
 * @example
 * <HomeFeatures />
 */
const HomeFeatures = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.200"
      aria-labelledby="features-heading"
    >
      <Container>
        {/* Section label — first beat */}
        <Box mb="clamp(2rem, calc(1.5rem + 2vw), 4rem)">
          <Text textStyle="eyebrow" color="verde.600" mb={3}>
            Como operamos
          </Text>
          <Text
            as="h2"
            id="features-heading"
            textStyle="title-2"
            color="charcoal.900"
            maxW="32ch"
          >
            Método como linguagem.
          </Text>
        </Box>

        {/* Cards grid — second beat */}
        <Grid
          templateColumns={{
            base: '1fr',
            sm: 'repeat(2, 1fr)',
            lg: 'repeat(4, 1fr)',
          }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
        >
          {PRINCIPLES.map((p) => {
            return <PrincipleCard key={p.verb} principle={p} />;
          })}
        </Grid>
      </Container>
    </Box>
  );
};

export default HomeFeatures;
