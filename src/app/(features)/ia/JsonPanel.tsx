'use client';

import { Box, Button } from '@chakra-ui/react';

type Props = {
  jsonPayload: unknown;
  showJson: boolean;
  onToggle: () => void;
};

export const JsonPanel = ({ jsonPayload, showJson, onToggle }: Props) => {
  if (!jsonPayload) {
    return null;
  }

  return (
    <Box>
      <Button size="sm" variant="outline" onClick={onToggle}>
        {showJson ? 'Ocultar JSON' : 'Ver JSON'}
      </Button>
      {showJson && (
        <Box
          mt={2}
          maxH="50vh"
          overflowY="auto"
          bgColor="bg.surface"
          borderWidth={1}
          borderColor="border.default"
          borderRadius="md"
          p={4}
        >
          <pre>{JSON.stringify(jsonPayload, null, 2)}</pre>
        </Box>
      )}
    </Box>
  );
};
