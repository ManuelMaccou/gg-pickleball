"use client"

import { IClient } from "@/app/types/databaseTypes";
import { IRewardWithCode } from "@/app/types/rewardTypes";
import { Box, Dialog, Flex, Strong, Text, VisuallyHidden } from "@radix-ui/themes";
import Image from "next/image";

interface RedeemRewardsDialogProps {
  reward: IRewardWithCode
  earnedInstance: { _id: string; rewardId: string; redeemed: boolean };
  location: IClient;
  showRedeemRewardsDialog: boolean;
  setShowRedeemRewardsDialog: (value: boolean) => void;
}

export default function RedeemRewardsDialog({
  reward,
  earnedInstance,
  location,
  showRedeemRewardsDialog,
  setShowRedeemRewardsDialog,
}: RedeemRewardsDialogProps) {

const rewardCode = reward.codes?.find(c => c._id === earnedInstance._id)?.code;

  return (
    <Dialog.Root open={showRedeemRewardsDialog} onOpenChange={setShowRedeemRewardsDialog}>
      <Dialog.Content>
        <Dialog.Title size={'6'} align={'center'}>Redeem your reward</Dialog.Title>
        <VisuallyHidden>
          <Dialog.Description> Redeem your reward</Dialog.Description>
        </VisuallyHidden>
        <Flex direction={'column'}>
          <Flex direction={'row'}>
            <Box position={'relative'} height={'100px'} width={'150px'}>
              <Image
                src={location.logo}
                alt={location.name ?? 'Location logo'}
                fill
                priority
                style={{objectFit: 'contain'}}
              />
            </Box>
            <Flex direction={'row'} align={'center'} justify={'center'} flexGrow={'1'} width={'100%'}>
              <Text align={'center'} size={'7'} weight={'bold'}
                style={{textTransform: "uppercase"}}
              >
                {reward.product}
              </Text>
            </Flex>
            
          </Flex>
          <Flex direction={'column'}>
            <Text size={'9'} weight={'bold'} align={'center'}>{reward.friendlyName}</Text>
          </Flex>
          <Flex direction={'column'} mt={'4'} gap={'4'}>
            <Text size={'4'} align={'center'}><Strong>To redeem: </Strong>Show this screen at the front desk, or call to make a reservation or order.</Text>
            <Text size={'4'} align={'right'}>
              <Strong>Code: </Strong>{rewardCode ?? 'Unavailable'}
            </Text>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}