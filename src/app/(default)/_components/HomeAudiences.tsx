import { Box, Grid, GridItem, Link, Stack, Text } from '@chakra-ui/react';
import NextLink from 'next/link';

import Container from '../../../components/ui/Container';

const EXPO_OUT = 'cubic-bezier(0.19, 1, 0.22, 1)';

type StatusEntry = { label: string; color: string };

const STATUS_LEGEND: StatusEntry[] = [
  { label: 'Validado', color: 'verde.600' },
  { label: 'Em tratamento', color: 'laranja.500' },
  { label: 'Cobertura parcial', color: 'roxo.600' },
  { label: 'Não identificado', color: 'charcoal.500' },
];

const DOTS: [number, number][] = [
  [130, 60],
  [160, 50],
  [190, 70],
  [210, 100],
  [185, 130],
  [155, 145],
  [130, 160],
  [110, 140],
  [95, 110],
  [115, 90],
  [170, 110],
  [145, 80],
];

const DOT_FILL = ['#337C59', '#FF9D00', '#69448C', '#7A716D'];

const LINES: [number, number, number, number][] = [
  [130, 60, 160, 50],
  [160, 50, 190, 70],
  [190, 70, 210, 100],
  [155, 145, 185, 130],
  [115, 90, 130, 60],
];

/** Abstract Brazil SVG map — decorative, aria-hidden. */
const MockMap = () => {
  return (
    <svg viewBox="0 0 320 260" width="100%" height="100%" aria-hidden="true">
      <path
        d="M100 20 L200 15 L240 40 L260 80 L250 130 L220 160 L200 200 L160 220 L120 210 L80 190 L60 150 L50 110 L60 70 Z"
        fill="none"
        stroke="#D8D1C5"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {LINES.map(([x1, y1, x2, y2], i) => {
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#D8D1C5"
            strokeWidth="1"
            opacity="0.6"
          />
        );
      })}
      {DOTS.map(([cx, cy], i) => {
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={i % 3 === 0 ? 5 : 3.5}
            fill={DOT_FILL[i % 4]}
            opacity={0.8}
          />
        );
      })}
    </svg>
  );
};

/**
 * MapEntrySection — abstract map preview on the left, text and CTA on the right.
 * Mock map shows Brazil outline with territorial dots and status legend.
 * No functional map code — pure CSS/SVG composition.
 *
 * @example
 * <HomeAudiences />
 */
const HomeAudiences = () => {
  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg="ivory.200"
      aria-labelledby="map-entry-heading"
    >
      <Container>
        <Grid
          templateColumns={{ base: '1fr', lg: 'repeat(12, 1fr)' }}
          gap="clamp(1rem, calc(0.75rem + 1vw), 1.75rem)"
          alignItems="center"
        >
          {/* Mock map — cols 1–6 */}
          <GridItem colSpan={{ base: 1, lg: 6 }}>
            <Box
              bg="ivory.50"
              borderRadius="card"
              overflow="hidden"
              position="relative"
              style={{ paddingBottom: '72%' }}
              aria-hidden="true"
            >
              <Box position="absolute" inset={0} p={6}>
                <MockMap />

                {/* Legend */}
                <Box
                  position="absolute"
                  bottom={5}
                  left={5}
                  display="flex"
                  flexDirection="column"
                  gap={1.5}
                >
                  {STATUS_LEGEND.map((s) => {
                    return (
                      <Box
                        key={s.label}
                        display="flex"
                        alignItems="center"
                        gap={2}
                      >
                        <Box w="6px" h="6px" borderRadius="full" bg={s.color} />
                        <Text textStyle="caption" color="charcoal.500">
                          {s.label}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>

                {/* Mock filters */}
                <Box
                  position="absolute"
                  top={5}
                  right={5}
                  display="flex"
                  flexDirection="column"
                  gap={2}
                >
                  {['UF', 'Fonte', 'Status'].map((f) => {
                    return (
                      <Box
                        key={f}
                        px={3}
                        py={1}
                        borderRadius="pill"
                        border="1px solid"
                        borderColor="ivory.400"
                        bg="ivory.100"
                        fontSize="0.6875rem"
                        letterSpacing="0.04em"
                        textTransform="uppercase"
                        color="charcoal.500"
                      >
                        {f}
                      </Box>
                    );
                  })}
                </Box>
              </Box>
            </Box>
          </GridItem>

          {/* Text + CTA — cols 8–12 */}
          <GridItem colSpan={{ base: 1, lg: 5 }} colStart={{ base: 1, lg: 8 }}>
            <Stack gap={6}>
              <Text textStyle="eyebrow" color="verde.600">
                Mapa
              </Text>
              <Text
                as="h2"
                id="map-entry-heading"
                textStyle="title-2"
                color="charcoal.900"
              >
                O território é a primeira camada de leitura.
              </Text>
              <Text textStyle="body-lg" color="charcoal.700">
                Explore registros por UF, município, fonte e status de
                validação. O mapa não encerra a realidade; ele indica onde olhar
                melhor.
              </Text>
              <Box>
                <Link
                  asChild
                  display="inline-flex"
                  alignItems="center"
                  minH="52px"
                  px={7}
                  borderRadius="pill"
                  bg="verde.600"
                  color="ivory.50"
                  fontSize="0.875rem"
                  fontWeight="500"
                  letterSpacing="0.04em"
                  textTransform="uppercase"
                  textDecoration="none"
                  transition={`all 0.3s ${EXPO_OUT}`}
                  _hover={{
                    bg: 'verde.700',
                    transform: 'translateY(-1px)',
                  }}
                >
                  <NextLink href="/mapas">Abrir mapa</NextLink>
                </Link>
              </Box>
            </Stack>
          </GridItem>
        </Grid>
      </Container>
    </Box>
  );
};

export default HomeAudiences;
