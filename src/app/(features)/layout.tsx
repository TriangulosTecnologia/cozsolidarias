import type * as React from 'react';

import DefaultLayout from '../../components/layouts/DefaultLayout';

/**
 * Layout for interactive feature pages (map, data viewer, etc.).
 *
 * Currently uses the same chrome as the default group.
 * Kept separate so feature pages can adopt a distinct layout
 * (e.g. full-screen, no footer) without touching informational pages.
 */
export default function FeaturesGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
