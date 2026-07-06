import { Box, SimpleGrid, Stack, Text } from '@chakra-ui/react';

import Container from '@/components/ui/Container';

import PartnerCard, { type Partner } from './PartnerCard';

type PartnersSectionProps = {
  /** Unique id used for `aria-labelledby`, e.g. `'internal-partners'`. */
  id: string;
  /** Small label above the title, e.g. `'Internos'`. */
  eyebrow: string;
  /** Section heading. */
  title: string;
  /** One-sentence explanation of what this category of partner means. */
  description: string;
  /** Partners rendered as cards in this section. */
  partners: Partner[];
  /** Section background, alternated between sections for visual rhythm. */
  bg: string;
};

/**
 * A category of partners (e.g. internal or external) rendered as a heading
 * followed by a responsive grid of `PartnerCard`s.
 *
 * @param props - Section content and the partners to list.
 *
 * @example
 * <PartnersSection
 *   id="internal-partners"
 *   eyebrow="Internos"
 *   title="Vínculo institucional"
 *   description="Instituições e redes de pesquisa às quais o projeto está vinculado."
 *   partners={INTERNAL_PARTNERS}
 *   bg="ivory.100"
 * />
 */
const PartnersSection = ({
  id,
  eyebrow,
  title,
  description,
  partners,
  bg,
}: PartnersSectionProps) => {
  const headingId = `${id}-heading`;

  return (
    <Box
      as="section"
      py="clamp(3rem, calc(2.25rem + 3vw), 6rem)"
      bg={bg}
      aria-labelledby={headingId}
    >
      <Container>
        <Stack gap={6}>
          <Stack gap={3} maxW="640px">
            <Text textStyle="eyebrow" color="verde.600">
              {eyebrow}
            </Text>
            <Text
              as="h2"
              id={headingId}
              textStyle="title-2"
              color="charcoal.900"
            >
              {title}
            </Text>
            <Text textStyle="body-sm" color="charcoal.700">
              {description}
            </Text>
          </Stack>

          <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
            {partners.map((partner) => {
              return <PartnerCard key={partner.name} partner={partner} />;
            })}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
};

export default PartnersSection;
