import { Box, Text } from '@chakra-ui/react';
import NextImage from 'next/image';

/** A single partner: an institution or agency shown on the `/parceiros` page. */
export type Partner = {
  /** Display name, e.g. `'CNPq'`. */
  name: string;
  /** One or two sentences explaining who they are and their tie to the project. */
  description: string;
  /** Path to the logo file under `public/`. */
  logoSrc: string;
};

type PartnerCardProps = { partner: Partner };

/**
 * Card showing a single partner's logo, name, and description.
 *
 * @param partner - The partner to display.
 *
 * @example
 * <PartnerCard partner={{ name: 'CNPq', description: '...', logoSrc: '/images/partners/cnpq.webp' }} />
 */
const PartnerCard = ({ partner }: PartnerCardProps) => {
  return (
    <Box
      p={6}
      bg="ivory.50"
      borderRadius="card"
      border="1px solid"
      borderColor="ivory.300"
    >
      <Box position="relative" h="56px" w="full" mb={4}>
        <NextImage
          src={partner.logoSrc}
          alt={partner.name}
          fill
          style={{ objectFit: 'contain', objectPosition: 'left center' }}
        />
      </Box>
      <Text textStyle="title-4" color="charcoal.900" mb={2}>
        {partner.name}
      </Text>
      <Text textStyle="body-sm" color="charcoal.700">
        {partner.description}
      </Text>
    </Box>
  );
};

export default PartnerCard;
