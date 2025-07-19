import { Box, Flex, Text, Strong } from '@radix-ui/themes';
import { BasePopulatedDoc } from '@/app/types/frontendTypes';
import { ReactNode } from 'react';

export function renderDataList(
  data: BasePopulatedDoc[] | Record<string, BasePopulatedDoc> | Map<string, BasePopulatedDoc> | null,
  dataType: 'achievements' | 'rewards',
  prefix: string
): ReactNode {
  let values: BasePopulatedDoc[];

  if (Array.isArray(data)) {
    values = data;
  } else if (data instanceof Map) {
    values = Array.from(data.values());
  } else if (data) {
    values = Object.values(data);
  } else {
    values = [];
  }

  if (values.length === 0) {
    return (
      <Box px="3" py="2">
        <Text size="1" color="gray">
          No items
        </Text>
      </Box>
    );
  }

  const sortedValues = [...values].sort((a, b) => {
    const aIndex = a.index ?? 0;
    const bIndex = b.index ?? 0;
    return aIndex - bIndex;
  });

  return (
    <Flex direction="column" pl="3">
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {sortedValues.map((item, index) => (
          <li key={`${prefix}-${item._id || index}`} style={{ padding: '4px 0' }}>
            {dataType === 'achievements' ? (
              <Text size="2">
                🏆 <Strong>{item.friendlyName || item.name}</Strong>
              </Text>
            ) : (
              <Text>
                🎁 <Strong>{item.friendlyName || item.name}{' '}{item.product}</Strong>
              </Text>
            )}
          </li>
        ))}
      </ul>
    </Flex>
  );
}
