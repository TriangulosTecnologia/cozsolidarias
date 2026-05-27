import type * as React from 'react';

import DefaultLayout from '../../components/layouts/DefaultLayout';

export default function DefaultGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DefaultLayout>{children}</DefaultLayout>;
}
