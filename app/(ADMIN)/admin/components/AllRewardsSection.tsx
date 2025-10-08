import { IRewardCode, IUser } from "@/app/types/databaseTypes";
import { Badge, Button, Callout, Flex, Spinner, Table, Text } from "@radix-ui/themes";
import { InfoCircledIcon } from "@radix-ui/react-icons";
import { DateTime } from "luxon";
import { useIsMobile } from "@/app/hooks/useIsMobile";

interface AllRewardsSectionProps {
  allRewardCodes: IRewardCode[];
  playerMap: Map<string, IUser>;
  handleRedeem: (rewardCode: string) => void;
  isRedeeming: string | null;
  redeemError: string | null;
}

const formatDate = (dateInput: string | Date | undefined | null): string => {
  if (!dateInput) {
    return '—';
  }
  // Check the type at runtime
  if (typeof dateInput === 'string') {
    // If it's a string, use fromISO
    return DateTime.fromISO(dateInput).toFormat('MM/dd/yy');
  } else if (dateInput instanceof Date) {
    // If it's a Date object, use fromJSDate
    return DateTime.fromJSDate(dateInput).toFormat('MM/dd/yy');
  }
  // Fallback for any other unexpected type
  return '—';
};

export default function AllRewardsSection({
  allRewardCodes,
  playerMap,
  handleRedeem,
  isRedeeming,
  redeemError
}: AllRewardsSectionProps) {

  const isMobile =useIsMobile();

  const sortedRewards = [...allRewardCodes].sort((a, b) => {
    const nameA = a.userId ? playerMap.get(a.userId.toString())?.name || 'zzzz' : 'zzzz';
    const nameB = b.userId ? playerMap.get(b.userId.toString())?.name || 'zzzz' : 'zzzz';

    if (a.redeemed !== b.redeemed) {
      return a.redeemed ? 1 : -1;
    }

    return nameA.localeCompare(nameB);
  });

  if (isMobile === null) {
    return null;
  }

  return (
    <Flex direction={'column'} flexGrow={'1'} pb={{initial: '0', md: '9'}}>
      <Flex direction={'column'} mb={'4'}>
        <Text ml={'2'} size={'4'} weight={'bold'} style={{ color: 'black' }}>
          All Rewards
        </Text>
        {isMobile && (
           <Text size={'2'} ml={'2'}><em>Scroll right to view more</em></Text>
        )}
      </Flex>
      

      {redeemError && (
        <Callout.Root color="red" mb="3">
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>{redeemError}</Callout.Text>
        </Callout.Root>
      )}

      
        {sortedRewards.length > 0 ? (
          <Table.Root size="1" variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>Player</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Reward</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Code</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>Redeemed On</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sortedRewards.map((rewardCodeEntry) => {
                const player = rewardCodeEntry.userId ? playerMap.get(rewardCodeEntry.userId.toString()) : null;
                const isCurrentButtonLoading = isRedeeming === rewardCodeEntry.code;
                const reward = rewardCodeEntry.reward;

                return (
                  <Table.Row key={rewardCodeEntry._id.toString()}>
                    <Table.RowHeaderCell>{player?.name || 'Guest/Unassigned'}</Table.RowHeaderCell>
                    <Table.Cell>
                      <Flex direction={'column'} width={'150px'}>
                        <Text>{reward.product !== 'custom' ? `${reward?.friendlyName} ${reward?.product}` : reward?.friendlyName}</Text>
                        {reward.product !== 'custom' && (
                          <Text size="1" color="gray">{reward.productDescription ? reward.productDescription : "All products"}</Text>
                        )}
                      </Flex>
                    </Table.Cell>
                    <Table.Cell>{rewardCodeEntry.code ?? '—'}</Table.Cell>
                    <Table.Cell>
                      {rewardCodeEntry.redeemed ? (
                        <Badge color="green">Redeemed</Badge>
                      ) : (
                        <Button
                          size={'1'}
                          onClick={() => handleRedeem(rewardCodeEntry.code)}
                          disabled={isCurrentButtonLoading}
                        >
                          {isCurrentButtonLoading ? <Spinner size="1" /> : 'Redeem'}
                        </Button>
                      )}
                    </Table.Cell>
                    <Table.Cell>
                      {formatDate(rewardCodeEntry.redemptionDate)}
                    </Table.Cell>
                  </Table.Row>
                );
              })}
            </Table.Body>
          </Table.Root>
        ) : (
          <Text as="p" size="2" color="gray" align="center">
            No rewards have been earned at this location yet.
          </Text>
        )}
    </Flex>
  );
}