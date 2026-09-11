import type { HoverTooltipConfig } from '@ttoss/geovis';

/**
 * Card styling for the spec-driven hover tooltip — a warm ivory surface with a
 * subtle border and elevation so it reads as a floating card above the map.
 * Values reference the Chakra design tokens (exposed as `--chakra-*` custom
 * properties on the document root by `<ChakraProvider>`), keeping the tooltip in
 * step with the app's visual language. The tooltip *content* (name + count) is
 * built with Chakra components in `mapaTooltips`.
 *
 * Its own module because both `geovisSpec` and `geovisCafLayers` attach it, and
 * importing it from either one into the other would close a cycle.
 *
 * @example
 * const layer = { ...base, hoverTooltip: { render, style: TOOLTIP_STYLE } };
 */
export const TOOLTIP_STYLE: NonNullable<HoverTooltipConfig['style']> = {
  background: 'var(--chakra-colors-ivory-50)',
  color: 'var(--chakra-colors-charcoal-900)',
  border: '1px solid var(--chakra-colors-ivory-300)',
  borderRadius: 'var(--chakra-radii-lg)',
  boxShadow: '0 4px 16px rgba(36, 31, 33, 0.12)',
  padding: 'var(--chakra-spacing-2) var(--chakra-spacing-3)',
  zIndex: 50,
};
