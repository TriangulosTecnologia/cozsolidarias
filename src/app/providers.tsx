'use client';

import { ChakraProvider } from '@chakra-ui/react';

import { system } from '@/config/theme';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return <ChakraProvider value={system}>{children}</ChakraProvider>;
};
