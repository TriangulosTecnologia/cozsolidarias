import { Box, HStack, Portal, Stack, Text, Tooltip } from '@chakra-ui/react';

type SourcedFieldProps = {
  /** Field label (e.g. "Situação"). */
  label: string;
  /** Formatted value to display, or `null`/empty when the source has none. */
  value: string | null;
  /** Provenance string shown in the tooltip (file/column/aggregation). */
  source: string;
  /** Optional caveat appended to the tooltip (e.g. "autodeclarado"). */
  note?: string;
  /** Text shown when `value` is empty. @default 'Sem informação' */
  emptyText?: string;
};

/**
 * A labelled datum with an information affordance that reveals its provenance.
 * The ℹ trigger opens a Chakra tooltip showing the `source` (and `note`), so
 * every enriched field states where it came from. Empty values render muted.
 *
 * @example
 * <SourcedField
 *   label="Situação"
 *   value="Habilitada"
 *   source="Banco de Cozinhas Solidárias (03/11/2025) — coluna 'Situação'"
 * />
 */
const SourcedField = ({
  label,
  value,
  source,
  note,
  emptyText = 'Sem informação',
}: SourcedFieldProps) => {
  const isEmpty = value === null || value.trim() === '';

  return (
    <Stack gap={0.5}>
      <HStack gap={1} align="center">
        <Text textStyle="caption" color="text.secondary" fontWeight="600">
          {label}
        </Text>
        <Tooltip.Root openDelay={100} closeDelay={100}>
          <Tooltip.Trigger asChild>
            <Box
              as="button"
              aria-label={`Origem: ${label}`}
              lineHeight="1"
              color="text.secondary"
              cursor="help"
              _hover={{ color: 'brand.fg' }}
            >
              <Text as="span" textStyle="caption" aria-hidden>
                ⓘ
              </Text>
            </Box>
          </Tooltip.Trigger>
          <Portal>
            <Tooltip.Positioner>
              <Tooltip.Content maxW="260px">
                <Tooltip.Arrow />
                <Text textStyle="caption">{source}</Text>
                {note ? (
                  <Text textStyle="caption" opacity={0.8} mt={1}>
                    {note}
                  </Text>
                ) : null}
              </Tooltip.Content>
            </Tooltip.Positioner>
          </Portal>
        </Tooltip.Root>
      </HStack>
      <Text
        textStyle="body-sm"
        color={isEmpty ? 'text.secondary' : 'text.primary'}
      >
        {isEmpty ? emptyText : value}
      </Text>
    </Stack>
  );
};

export default SourcedField;
