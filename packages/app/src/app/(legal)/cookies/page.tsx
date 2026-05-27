'use client';

import { useI18n } from '@ttoss/react-i18n';

export default function CookiesPage() {
  const { intl } = useI18n();
  return (
    <p>
      {intl.formatMessage({
        defaultMessage: 'Cookie Policy — coming soon.',
        description:
          'Placeholder text for the Cookie Policy page while content is being developed.',
      })}
    </p>
  );
}
