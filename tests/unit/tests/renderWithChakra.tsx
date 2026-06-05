import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { render, type RenderOptions } from '@testing-library/react';
import type * as React from 'react';

/**
 * Renders `ui` wrapped in a Chakra provider so components that rely on Chakra
 * context (Link, Box, NativeSelect, …) work under jsdom. Uses Chakra's
 * `defaultSystem` — tests assert behavior/markup, not the project's design
 * tokens, so the real theme is intentionally not loaded here.
 */
export const renderWithChakra = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) => {
    return <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>;
  };

  return render(ui, { wrapper: Wrapper, ...options });
};
