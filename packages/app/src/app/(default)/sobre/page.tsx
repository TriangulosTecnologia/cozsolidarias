'use client';

import { useI18n } from '@ttoss/react-i18n';

export default function SobrePage() {
  const { intl } = useI18n();
  return (
    <p>
      {intl.formatMessage({
        defaultMessage: 'About — coming soon.',
        description:
          'Placeholder text for the About page while content is being developed.',
      })}
    </p>
  );
}
