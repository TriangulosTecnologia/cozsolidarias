import {
  Badge,
  Box,
  Heading,
  HStack,
  Stack,
  Text,
  VStack,
} from '@chakra-ui/react';

import { formatDistance } from '../indicators';
import type { NearbyGroup } from '../nearbySpec';

type NearbyListProps = {
  groups: NearbyGroup[];
};

/**
 * Per-category POI list (only non-empty categories), each item showing its
 * name, distance and ring.
 *
 * @example
 * <NearbyList groups={groupByCategory(nearby.features)} />
 */
const NearbyList = ({ groups }: NearbyListProps) => {
  return (
    <Stack gap={5}>
      {groups
        .filter((group) => {
          return group.items.length > 0;
        })
        .map((group) => {
          return (
            <Box key={group.category}>
              <HStack gap={2} mb={2}>
                <Box w="10px" h="10px" borderRadius="pill" bg={group.color} />
                <Heading as="h3" textStyle="body" color="text.primary">
                  {group.label}
                </Heading>
                <Text textStyle="body-sm" color="text.secondary">
                  {group.items.length}
                </Text>
              </HStack>
              <VStack align="stretch" gap={1}>
                {group.items.map((item) => {
                  return (
                    <HStack
                      key={item.properties.id}
                      justify="space-between"
                      gap={3}
                      py={1}
                      borderBottomWidth="1px"
                      borderColor="ivory.300"
                    >
                      <Text textStyle="body-sm" color="text.primary">
                        {item.properties.name ?? '(sem nome)'}
                      </Text>
                      <HStack gap={2} flexShrink={0}>
                        <Text textStyle="caption" color="text.secondary">
                          {formatDistance(item.properties.distanceMeters)}
                        </Text>
                        <Badge size="sm" variant="surface">
                          {item.properties.ring} m
                        </Badge>
                      </HStack>
                    </HStack>
                  );
                })}
              </VStack>
            </Box>
          );
        })}
    </Stack>
  );
};

export default NearbyList;
