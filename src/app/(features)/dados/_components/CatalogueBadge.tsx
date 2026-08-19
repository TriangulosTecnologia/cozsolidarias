import { Box } from '@chakra-ui/react';

/**
 * Meaning carried by a badge's colour.
 *
 * - `neutral` — a plain fact (file format, volume).
 * - `positive` — an openly publishable dataset.
 * - `alert` — a restriction or a documented gap.
 */
export type CatalogueBadgeTone = 'neutral' | 'positive' | 'alert';

const TONES: Record<CatalogueBadgeTone, { bg: string; color: string }> = {
  neutral: { bg: 'ivory.200', color: 'charcoal.700' },
  positive: { bg: 'mistGreen', color: 'verde.700' },
  alert: { bg: 'coral.50', color: 'coral.700' },
};

type Props = {
  children: React.ReactNode;
  /**
   * Colour meaning of the badge.
   *
   * @default 'neutral'
   */
  tone?: CatalogueBadgeTone;
};

/**
 * Pill-shaped metadata badge in the catalogue's visual language — the same
 * treatment the home page uses for a dataset's status. Server Component.
 *
 * @example
 * <CatalogueBadge>CSV</CatalogueBadge>
 * <CatalogueBadge tone="alert">Restrito</CatalogueBadge>
 */
const CatalogueBadge = ({ children, tone = 'neutral' }: Props) => {
  return (
    <Box
      as="span"
      display="inline-flex"
      alignItems="center"
      px={3}
      py={1}
      borderRadius="pill"
      bg={TONES[tone].bg}
      color={TONES[tone].color}
      fontSize="0.75rem"
      fontWeight="500"
      letterSpacing="0.04em"
      textTransform="uppercase"
      whiteSpace="nowrap"
    >
      {children}
    </Box>
  );
};

export default CatalogueBadge;
