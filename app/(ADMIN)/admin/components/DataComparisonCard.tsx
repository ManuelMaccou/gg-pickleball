'use client';

import { Box, Button, Card, Code, Flex, Grid, Heading, Text, Spinner, Badge } from "@radix-ui/themes";
import * as Dialog from '@radix-ui/react-dialog';
import { areObjectsDifferent } from "@/utils/objectDiff";
import { BasePopulatedDoc } from "@/app/types/frontendTypes";

interface DataComparisonCardProps {
  title: string;
  sourceData: BasePopulatedDoc[] | Record<string, BasePopulatedDoc>;
  destinationData: BasePopulatedDoc[] | Record<string, BasePopulatedDoc>;
  onCopy: () => void;
  isUpdating: boolean;
}

export const DataComparisonCard = ({
  title,
  sourceData,
  destinationData,
  onCopy,
  isUpdating,
}: DataComparisonCardProps) => {
  const dataIsDifferent = areObjectsDifferent(sourceData, destinationData);

  return (
    <Dialog.Root>
      <Card mt="4">
        <Flex direction="column" gap="3">
          <Flex justify="between" align="center">
            <Heading size="4">{title}</Heading>
            <Badge color={dataIsDifferent ? "orange" : "green"} highContrast>
              {dataIsDifferent ? "Differences Found" : "No Differences"}
            </Badge>
          </Flex>
          <Grid columns="2" gap="4">
            <Box>
              <Text size="2" weight="bold" mb="2">Alternative (Source)</Text>
              <Card variant="surface" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <pre><Code>{JSON.stringify(sourceData, null, 2)}</Code></pre>
              </Card>
            </Box>
            <Box>
              <Text size="2" weight="bold" mb="2">Current (Destination)</Text>
              <Card variant="surface" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <pre><Code>{JSON.stringify(destinationData, null, 2)}</Code></pre>
              </Card>
            </Box>
          </Grid>
          <Flex justify="end" mt="3">
            <Dialog.Trigger asChild>
              <Button disabled={isUpdating || !dataIsDifferent}>
                {isUpdating ? <Spinner /> : 'Copy Alternative to Current'}
              </Button>
            </Dialog.Trigger>
          </Flex>
        </Flex>
      </Card>

      <Dialog.Content>
        <Dialog.Title asChild><Heading size="4">Confirm Action</Heading></Dialog.Title>
        <Dialog.Description asChild>
          <Text as="p" my="4">
            Are you sure you want to overwrite the &quot;Current&quot; data with the &quot;Alternative&quot; data? This action cannot be undone.
          </Text>
        </Dialog.Description>
        <Flex gap="3" justify="end">
          <Dialog.Close asChild><Button variant="soft" color="gray">Cancel</Button></Dialog.Close>
          <Dialog.Close asChild><Button onClick={onCopy} color="red">Yes, Overwrite Data</Button></Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
};
