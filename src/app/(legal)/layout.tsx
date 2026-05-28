import type * as React from 'react';

import LegalLayout from '../../components/layouts/LegalLayout';

export default function LegalGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <LegalLayout>{children}</LegalLayout>;
}
