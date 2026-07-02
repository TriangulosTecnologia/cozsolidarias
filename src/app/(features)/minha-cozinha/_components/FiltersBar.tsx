import { Box, HStack, NativeSelect } from '@chakra-ui/react';

import type { NearbyKitchen, NearbyProvider } from '@/data-gateway/schema';

import KitchenCombobox from './KitchenCombobox';

type FiltersBarProps = {
  kitchens: NearbyKitchen[];
  selectedCodigo: string | null;
  provider: NearbyProvider;
  onSelect: (kitchen: NearbyKitchen) => void;
  onClear: () => void;
  onProviderChange: (provider: NearbyProvider) => void;
};

/**
 * Top filter bar: the kitchen search combobox plus the data-source (provider)
 * select, which defaults to OSM so selecting a kitchen loads immediately.
 *
 * @example
 * <FiltersBar kitchens={kitchens} selectedCodigo={null} provider="osm"
 *   onSelect={load} onClear={clear} onProviderChange={change} />
 */
const FiltersBar = ({
  kitchens,
  selectedCodigo,
  provider,
  onSelect,
  onClear,
  onProviderChange,
}: FiltersBarProps) => {
  return (
    <HStack
      gap={3}
      px={{ base: 4, md: 8 }}
      py={3}
      borderBottomWidth="1px"
      borderColor="ivory.300"
      bg="surface.card"
    >
      <Box flex="1" minW={0} maxW="480px">
        <KitchenCombobox
          kitchens={kitchens}
          selectedCodigo={selectedCodigo}
          onSelect={onSelect}
          onClear={onClear}
        />
      </Box>
      <NativeSelect.Root size="sm" w="auto" flexShrink={0}>
        <NativeSelect.Field
          value={provider}
          onChange={(event) => {
            onProviderChange(event.currentTarget.value as NearbyProvider);
          }}
          aria-label="Fonte dos dados"
        >
          <option value="osm">OpenStreetMap</option>
          <option value="google">Google Maps</option>
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </HStack>
  );
};

export default FiltersBar;
