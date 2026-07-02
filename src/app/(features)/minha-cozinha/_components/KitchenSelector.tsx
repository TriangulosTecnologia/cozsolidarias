import { Box, Button, Input, Text, VStack } from '@chakra-ui/react';

import type { NearbyKitchen } from '@/data-gateway/schema';

type KitchenSelectorProps = {
  query: string;
  onQueryChange: (value: string) => void;
  kitchens: NearbyKitchen[];
  selectedCodigo: string | null;
  onSelect: (kitchen: NearbyKitchen) => void;
  showEmpty: boolean;
};

/**
 * Search box + scrollable, selectable list of the available kitchens.
 *
 * @param props - Filtered `kitchens`, the `query` and its `onQueryChange`,
 * the `selectedCodigo`, an `onSelect` callback, and `showEmpty` to render the
 * empty-state message.
 *
 * @example
 * <KitchenSelector kitchens={filtered} query={query} onQueryChange={setQuery}
 *   selectedCodigo={selected?.codigo ?? null} onSelect={load} showEmpty />
 */
const KitchenSelector = ({
  query,
  onQueryChange,
  kitchens,
  selectedCodigo,
  onSelect,
  showEmpty,
}: KitchenSelectorProps) => {
  return (
    <Box flex="1" minW={0} w="100%">
      <Input
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
        }}
        placeholder="Buscar por nome, município, UF ou código…"
        aria-label="Buscar cozinha"
        mb={3}
      />
      <VStack align="stretch" gap={1} maxH="320px" overflowY="auto" pr={1}>
        {kitchens.map((kitchen) => {
          const isActive = selectedCodigo === kitchen.codigo;
          return (
            <Button
              key={kitchen.codigo}
              onClick={() => {
                onSelect(kitchen);
              }}
              variant={isActive ? 'solid' : 'outline'}
              colorPalette={isActive ? 'green' : 'gray'}
              justifyContent="flex-start"
              h="auto"
              py={2}
              px={3}
              whiteSpace="normal"
              textAlign="left"
            >
              <Box>
                <Text textStyle="body-sm" fontWeight="600">
                  {kitchen.nome || kitchen.codigo}
                </Text>
                <Text textStyle="caption" color="text.secondary">
                  {kitchen.municipio} — {kitchen.uf}
                </Text>
              </Box>
            </Button>
          );
        })}
        {showEmpty ? (
          <Text textStyle="body-sm" color="text.secondary" py={2}>
            Nenhuma cozinha encontrada.
          </Text>
        ) : null}
      </VStack>
    </Box>
  );
};

export default KitchenSelector;
