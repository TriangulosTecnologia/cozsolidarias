import { Combobox, createListCollection } from '@chakra-ui/react';
import * as React from 'react';

import type { NearbyKitchen } from '@/data-gateway/schema';

type KitchenComboboxProps = {
  kitchens: NearbyKitchen[];
  selectedCodigo: string | null;
  onSelect: (kitchen: NearbyKitchen) => void;
  onClear: () => void;
};

const label = (kitchen: NearbyKitchen): string => {
  return `${kitchen.nome || kitchen.codigo} — ${kitchen.municipio}/${kitchen.uf}`;
};

const matches = (kitchen: NearbyKitchen, term: string): boolean => {
  return `${label(kitchen)} ${kitchen.codigo}`
    .toLowerCase()
    .includes(term.trim().toLowerCase());
};

/**
 * Searchable select of the available kitchens. Typing filters by name,
 * município, UF or código; picking one calls `onSelect`.
 *
 * @example
 * <KitchenCombobox kitchens={all} selectedCodigo={selected?.codigo ?? null}
 *   onSelect={load} />
 */
const KitchenCombobox = ({
  kitchens,
  selectedCodigo,
  onSelect,
  onClear,
}: KitchenComboboxProps) => {
  const [term, setTerm] = React.useState('');

  const filtered = React.useMemo(() => {
    return kitchens.filter((kitchen) => {
      return matches(kitchen, term);
    });
  }, [kitchens, term]);

  const collection = React.useMemo(() => {
    return createListCollection({
      items: filtered,
      itemToValue: (kitchen) => {
        return kitchen.codigo;
      },
      itemToString: label,
    });
  }, [filtered]);

  return (
    <Combobox.Root
      collection={collection}
      value={selectedCodigo ? [selectedCodigo] : []}
      onInputValueChange={(details) => {
        setTerm(details.inputValue);
      }}
      onValueChange={(details) => {
        const code = details.value[0];
        if (!code) {
          onClear();
          return;
        }
        const kitchen = kitchens.find((candidate) => {
          return candidate.codigo === code;
        });
        if (kitchen) {
          onSelect(kitchen);
        }
      }}
      openOnClick
      maxW={{ base: '100%', md: '480px' }}
    >
      <Combobox.Label srOnly>Selecionar cozinha</Combobox.Label>
      <Combobox.Control>
        <Combobox.Input placeholder="Buscar cozinha por nome, município, UF ou código…" />
        <Combobox.IndicatorGroup>
          <Combobox.ClearTrigger />
          <Combobox.Trigger />
        </Combobox.IndicatorGroup>
      </Combobox.Control>
      <Combobox.Positioner>
        <Combobox.Content maxH="320px" overflowY="auto">
          <Combobox.Empty>Nenhuma cozinha encontrada.</Combobox.Empty>
          {filtered.map((kitchen) => {
            return (
              <Combobox.Item key={kitchen.codigo} item={kitchen}>
                <Combobox.ItemText>{label(kitchen)}</Combobox.ItemText>
                <Combobox.ItemIndicator />
              </Combobox.Item>
            );
          })}
        </Combobox.Content>
      </Combobox.Positioner>
    </Combobox.Root>
  );
};

export default KitchenCombobox;
