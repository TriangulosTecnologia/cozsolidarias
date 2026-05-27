'use client';

import { Text } from '@chakra-ui/react';
import { useI18n } from '@ttoss/react-i18n';

/**
 * Translatable FAPESP project attribution text shown in the footer.
 *
 * @example
 * <ProjectReference />
 */
const ProjectReference = () => {
  const { intl } = useI18n();
  return (
    <Text fontSize="sm">
      {intl.formatMessage({
        defaultMessage: 'FAPESP Solidarity Kitchens Project',
        description:
          'Full project attribution shown in the footer, including FAPESP as the funding agency.',
      })}
    </Text>
  );
};

export default ProjectReference;
