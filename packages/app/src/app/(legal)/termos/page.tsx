'use client';

import { useI18n } from '@ttoss/react-i18n';

export default function TermosPage() {
  const { intl } = useI18n();
  return (
    <p>
      {intl.formatMessage({
        defaultMessage: 'Terms of Use — coming soon.',
        description:
          'Placeholder text for the Terms of Use page while content is being developed.',
      })}
    </p>
  );
}
