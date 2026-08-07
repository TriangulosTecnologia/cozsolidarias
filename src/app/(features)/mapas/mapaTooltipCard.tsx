import { Box, Text } from '@chakra-ui/react';
import type * as React from 'react';

/**
 * Tooltip card shared by every município/point hover tooltip: a bold title, an
 * optional band swatch next to the primary label, an optional secondary line,
 * and optional extra detail lines. Omit `swatchColor` in modes without
 * data-driven paint (e.g. `pontos`), where a colored square would represent no
 * band.
 *
 * @param params.name - Bold title (município or point name).
 * @param params.swatchColor - Band color square; omit to hide it.
 * @param params.primary - Primary label shown next to the swatch.
 * @param params.secondary - Optional auxiliary line under the primary.
 * @param params.details - Optional extra detail lines.
 * @returns The tooltip card element.
 *
 * @example
 * <TooltipCard name="São Paulo" swatchColor="#1d4ed8" primary="5 cozinhas" />
 */
export const TooltipCard = ({
  name,
  swatchColor,
  primary,
  secondary,
  details,
}: {
  name: string;
  swatchColor?: string;
  primary: string;
  secondary?: string;
  details?: string[];
}): React.ReactNode => {
  return (
    <Box display="flex" flexDirection="column" gap="1.5" minW="180px">
      <Text fontWeight="bold" fontSize="sm" lineHeight="tight">
        {name}
      </Text>
      <Box display="flex" alignItems="center" gap="2">
        {swatchColor === undefined ? null : (
          <Box
            w="12px"
            h="12px"
            borderRadius="sm"
            flexShrink={0}
            bg={swatchColor}
          />
        )}
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {primary}
        </Text>
      </Box>
      {secondary === undefined ? null : (
        <Text fontSize="xs" color="text.secondary" lineHeight="tight">
          {secondary}
        </Text>
      )}
      {details?.map((line) => {
        return (
          <Text
            key={line}
            fontSize="xs"
            color="text.secondary"
            lineHeight="tight"
          >
            {line}
          </Text>
        );
      })}
    </Box>
  );
};
