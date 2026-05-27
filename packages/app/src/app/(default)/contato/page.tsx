'use client';

import { useI18n } from '@ttoss/react-i18n';

export default function ContatoPage() {
  const { intl } = useI18n();
  return (
    <p>
      {intl.formatMessage({
        defaultMessage: 'Contact — coming soon.',
        description:
          'Placeholder text for the Contact page while content is being developed.',
      })}
    </p>
  );
}
