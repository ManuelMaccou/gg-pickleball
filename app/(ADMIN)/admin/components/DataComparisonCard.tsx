'use client';

import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Text,
  Spinner,
  Badge,
  Dialog,
} from '@radix-ui/themes';
import { areObjectsDifferent } from '@/utils/objectDiff';
import { BasePopulatedDoc } from '@/app/types/frontendTypes';
import { renderDataList } from './RenderDataList';

interface DataComparisonCardProps {
  title: string;
  sourceData: BasePopulatedDoc[] | Record<string, BasePopulatedDoc>;
  destinationData: BasePopulatedDoc[] | Record<string, BasePopulatedDoc>;
  onCopy: () => void;
  isUpdating: boolean;
  dataType: 'achievements' | 'rewards';
}

export const DataComparisonCard = ({
  title,
  sourceData,
  destinationData,
  onCopy,
  isUpdating,
  dataType,
}: DataComparisonCardProps) => {
  const dataIsDifferent = areObjectsDifferent(sourceData, destinationData);

  return (
    <Card mt="4">
      <Flex direction="column" gap="3">
        <Flex justify="between" align="center">
          <Heading size="4">{title}</Heading>
          <Badge color={dataIsDifferent ? 'orange' : 'green'} highContrast>
            {dataIsDifferent ? 'Differences Found' : 'No Differences'}
          </Badge>
        </Flex>

        <Grid columns="2" gap="4">
          <Box style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <Text size="2" weight="bold" mb="2">
              Alternative (Source)
            </Text>
            <Card variant="surface">
              {renderDataList(sourceData, dataType, 'source')}
            </Card>
          </Box>

          <Box style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <Text size="2" weight="bold" mb="2">
              Current (Destination)
            </Text>
            <Card variant="surface">
              {renderDataList(destinationData, dataType, 'destination')}
            </Card>
          </Box>
        </Grid>

        <Flex justify="end" mt="3">
          <Dialog.Root>
            <Dialog.Trigger>
              <Button disabled={isUpdating || !dataIsDifferent} style={{width: '150px'}}>
                {isUpdating ? <Spinner /> : 'Sync'}
              </Button>
            </Dialog.Trigger>

            <Dialog.Content>
              <Dialog.Title>
                Confirm Action
              </Dialog.Title>
              <Dialog.Description>
                <Text my="4">
                  Are you sure you want to overwrite the &quot;Current&quot; data with the &quot;Alternative&quot; data? This action cannot be undone.
                </Text>
              </Dialog.Description>
              <Flex gap="3" justify="end">
                <Dialog.Close>
                  <Button variant="soft" color="gray">
                    Cancel
                  </Button>
                </Dialog.Close>
                <Dialog.Close>
                  <Button onClick={onCopy} color="red">
                    Yes, Overwrite Data
                  </Button>
                </Dialog.Close>
              </Flex>
            </Dialog.Content>
          </Dialog.Root>
        </Flex>
      </Flex>
    </Card>
  );
};
