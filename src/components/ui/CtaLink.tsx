import { Link } from '@chakra-ui/react';
import NextLink from 'next/link';

import { EXPO_OUT } from '../../config/site';

/** Visual variant of the call-to-action link. */
export type CtaVariant =
  | 'solid'
  | 'outline'
  | 'outline-dark'
  | 'solid-laranja'
  | 'ghost';

type Props = {
  /** Destination passed directly to `next/link`. */
  href: string;
  children: React.ReactNode;
  /**
   * Visual variant.
   *
   * - `solid` — verde.600 fill; default; use on light backgrounds.
   * - `outline` — ivory border; use on light backgrounds.
   * - `outline-dark` — verde border + ivory text; use on dark (verde.900) backgrounds.
   * - `solid-laranja` — laranja.500 fill + charcoal text; use on dark backgrounds.
   * - `ghost` — text-only link; tertiary action.
   *
   * @default 'solid'
   */
  variant?: CtaVariant;
};

const getBg = (v: CtaVariant) => {
  if (v === 'solid') return 'verde.600';
  if (v === 'solid-laranja') return 'laranja.500';
  return undefined;
};

const getColor = (v: CtaVariant) => {
  if (v === 'solid') return 'ivory.50';
  if (v === 'solid-laranja') return 'charcoal.900';
  if (v === 'outline-dark') return 'ivory.100';
  if (v === 'ghost') return 'verde.400';
  return 'charcoal.900';
};

const getBorderColor = (v: CtaVariant) => {
  if (v === 'outline') return 'ivory.400';
  if (v === 'outline-dark') return 'verde.600';
  return undefined;
};

const getHover = (v: CtaVariant) => {
  if (v === 'solid') return { bg: 'verde.700', transform: 'translateY(-1px)' };
  if (v === 'outline')
    return {
      bg: 'ivory.200',
      borderColor: 'charcoal.700',
      transform: 'translateY(-1px)',
    };
  if (v === 'outline-dark')
    return {
      borderColor: 'verde.400',
      color: 'ivory.50',
      transform: 'translateY(-1px)',
    };
  if (v === 'solid-laranja')
    return { bg: 'laranja.400', transform: 'translateY(-1px)' };
  return { color: 'verde.300', textDecoration: 'underline' };
};

/**
 * Pill-shaped call-to-action link. Wraps a `next/link` with the design-system
 * motion primitive and four colour variants. Server Component — no hooks.
 *
 * @example
 * <CtaLink href="/mapas">Explorar mapa</CtaLink>
 * <CtaLink href="/sobre" variant="outline">Saiba mais</CtaLink>
 * <CtaLink href="/contato" variant="outline-dark">Entrar em contato</CtaLink>
 * <CtaLink href="/contato" variant="solid-laranja">Colaborar</CtaLink>
 * <CtaLink href="/metodologia" variant="ghost">Ver metodologia</CtaLink>
 */
const CtaLink = ({ href, children, variant = 'solid' }: Props) => {
  const isGhost = variant === 'ghost';
  const hasBorder = variant === 'outline' || variant === 'outline-dark';

  return (
    <Link
      asChild
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      minH={isGhost ? '44px' : '52px'}
      px={isGhost ? 5 : 7}
      borderRadius={isGhost ? undefined : 'pill'}
      fontSize="0.875rem"
      fontWeight="500"
      letterSpacing="0.04em"
      textTransform="uppercase"
      textDecoration="none"
      transition={`all 0.3s ${EXPO_OUT}`}
      bg={getBg(variant)}
      color={getColor(variant)}
      border={hasBorder ? '1px solid' : undefined}
      borderColor={getBorderColor(variant)}
      _hover={getHover(variant)}
    >
      <NextLink href={href}>{children}</NextLink>
    </Link>
  );
};

export default CtaLink;
