"use client"

import { IClient } from "@/app/types/databaseTypes";
import { IRewardWithCode } from "@/app/types/rewardTypes";
import { Dialog, Flex, Strong, Text, VisuallyHidden } from "@radix-ui/themes";
import Image from "next/image";

interface RedeemRewardsDialogProps {
  reward: IRewardWithCode
  earnedInstance: { _id: string; redeemed: boolean };
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
        <VisuallyHidden>
          <Dialog.Title size={'6'} align={'center'}>Redeem your reward</Dialog.Title>
          <Dialog.Description> Redeem your reward</Dialog.Description>
        </VisuallyHidden>
        <Flex direction={'column'}>
          <Flex 
            direction={'column'}
            align={'center'}
          >
            <Flex direction={'column'} align={'center'} position={'relative'} height={'100px'} width={'150px'}>
              <Image
                src={location.logo}
                alt={location.name ?? 'Location logo'}
                fill
                priority
                style={{objectFit: 'contain'}}
              />
            </Flex>

            {reward.product !== 'custom' && (
              <Flex direction={'row'} align={'center'} justify={'center'} flexGrow={'1'} width={'100%'}>
                <Text align={'center'} size={'6'} weight={'bold'}
                  style={{textTransform: "uppercase"}}
                >
                  {reward.product}
                </Text>
              </Flex>
            )}
            
          </Flex>
          <Flex direction={'column'}>
            <Text size={reward.product === 'custom' ? '7' : '9'} weight={'bold'} align={'center'}>{reward.friendlyName}</Text>
          </Flex>

          {reward.productDescription && (
            <Flex direction={'column'} align={'center'} mt={'3'}>
              <Text align={'center'}>{reward.productDescription}</Text>
            </Flex>
          )}
          
          {reward.minimumSpend && reward.product === 'pro shop' ? (
            <Flex direction={'column'} align={'center'} mt={'3'}>
              <Text align={'center'}>Minimum spend to qualify: ${reward.minimumSpend}</Text>
            </Flex>
          ) : reward.maxDiscount && reward.product === 'pro shop' ? (
            <Flex direction={'column'} align={'center'} mt={'3'}>
              <Text align={'center'}>Max discount amount: ${reward.maxDiscount}</Text>
            </Flex>
          ) : null}
          <Flex direction={'column'} mt={'4'} gap={'4'}>
            <Text size={'4'}><Strong>To redeem: </Strong>
              Show this screen at the front desk, or call. 
              Certain restrictions may apply. Visit club for details.
            </Text>
            <Text size={'4'} align={'right'}>
              <Strong>Code: </Strong>{rewardCode ?? 'Unavailable'}
            </Text>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  )
}