import { Box, Button } from '@chakra-ui/react';
import { useCompactViewport } from '@ttoss/geovis';
import * as React from 'react';

import type { EnabledShareContext } from './enabledShareContext';
import MunicipalCoverageLegendContent from './MunicipalCoverageLegendContent';

/** Compact disclosure keeps the map visible on phones. */
const MunicipalCoverageLegend = ({
  state,
}: {
  state: NonNullable<React.ContextType<typeof EnabledShareContext>>;
}) => {
  const compact = useCompactViewport();
  const [open, setOpen] = React.useState(false);
  return (
    <Box
      position="absolute"
      top="3"
      right="14"
      zIndex={5}
      bg="ivory.50"
      borderWidth="1px"
      borderRadius="lg"
      p="3"
      maxW={{ base: '240px', md: '310px' }}
      maxH={{ base: '65%', md: '50%' }}
      overflowY="auto"
      aria-label="Legenda da habilitação municipal"
    >
      {compact && (
        <Button
          size="xs"
          aria-expanded={open}
          onClick={() => {
            return setOpen((value) => {
              return !value;
            });
          }}
        >
          Tm 2025 · legenda
        </Button>
      )}
      <Box display={!compact || open ? 'block' : 'none'}>
        <MunicipalCoverageLegendContent state={state} />
      </Box>
    </Box>
  );
};
export default MunicipalCoverageLegend;
