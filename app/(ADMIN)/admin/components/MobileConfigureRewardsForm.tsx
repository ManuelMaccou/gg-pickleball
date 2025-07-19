import { IAchievement } from "@/app/types/databaseTypes";
import { Cross1Icon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Button,
  Dialog,
  Em,
  Flex,
  Select,
  SegmentedControl,
  Text,
  TextField,
  VisuallyHidden,
} from "@radix-ui/themes";
import Link from "next/link";

interface MobileRewardFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedAchievement: IAchievement;
  discountAmount: number | null;
  discountType: "percent" | "dollars";
  discountProduct: "open play" | "reservation" | "pro shop";
  maxDiscount: number | null;
  minimumSpend: number | null;
  isSavingReward: boolean;
  isRemovingReward: boolean;
  isConfigured: boolean;
  rewardSuccess: boolean;
  rewardError: boolean;
  onSetAmount: (amount: number | null) => void;
  onSetType: (type: "percent" | "dollars") => void;
  onSetProduct: (product: "open play" | "reservation" | "pro shop") => void;
  onSetMinimumSpend: (amount: number | null) => void;
  onSetMaxDiscount: (amount: number | null) => void;
  onSave: () => void;
  onRemove: () => void;
}

export default function MobileConfigureRewardsForm({
  open,
  onOpenChange,
  selectedAchievement,
  discountAmount,
  discountType,
  discountProduct,
  minimumSpend,
  maxDiscount,
  isSavingReward,
  isRemovingReward,
  isConfigured,
  rewardSuccess,
  rewardError,
  onSetAmount,
  onSetType,
  onSetProduct,
  onSetMinimumSpend,
  onSetMaxDiscount,
  onSave,
  onRemove,
}: MobileRewardFormProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <VisuallyHidden>
          <Dialog.Title>Configure reward</Dialog.Title>
          <Dialog.Description>Configure rewar</Dialog.Description>
        </VisuallyHidden>
       
        <Dialog.Close>
          <Flex justify="end" mb="4">
            <Cross1Icon width="20px" height="20px" />
          </Flex>
        </Dialog.Close>

        <Flex direction="column" gap="5" justify={'between'} minHeight={'500px'} pb={'9'}>
          <Flex direction={'column'} gap={'5'}>
            <Text size="4" weight="bold">
              {selectedAchievement.friendlyName}
            </Text>
            {/* Discount Field */}
            <Flex direction="column" gap="2">
              <Text size="3">Discount</Text>
              <Flex gap="3" justify="between">
                <TextField.Root
                  type="number"
                  placeholder="Discount amount"
                  value={discountAmount ?? ''}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    onSetAmount(e.target.value === '' || isNaN(val) ? null : val);
                  }}
                />
                <SegmentedControl.Root
                  value={discountType}
                  onValueChange={(val) => onSetType(val as "percent" | "dollars")}
                >
                  <SegmentedControl.Item value="percent">Percent</SegmentedControl.Item>
                  <SegmentedControl.Item value="dollars">Dollars</SegmentedControl.Item>
                </SegmentedControl.Root>
              </Flex>
            </Flex>

          {/* Product Field */}
            <Flex direction="column" gap="1">
              <Text size="3">Product</Text>
              <Text size="1" mt="-1" mb={'3'}><Em>The product category to discount</Em></Text>
              <Select.Root
                value={discountProduct}
                onValueChange={(val) =>
                  onSetProduct(val as "open play" | "reservation" | "pro shop")
                }
              >
                <Select.Trigger />
                <Select.Content>
                  <Select.Item value="reservation">Court reservation</Select.Item>
                  <Select.Item value="open play">Open Play</Select.Item>
                  <Select.Item value="pro shop">Pro shop</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>

            {discountProduct === 'pro shop' && (
              <Flex direction={'column'} gap={'5'}>
                <Flex direction={'column'} gap={'2'}>
                  <Text size={'3'}>Minimum spend (optional)</Text>
                  <Text size={'1'} mt={'-2'}><Em> The minimum amount the customer must spend to qualify for this discount.</Em></Text>
                  <TextField.Root
                    type="number"
                    placeholder="Minimum spend"
                    value={minimumSpend ?? ''}
                    style={{flexGrow: '1'}}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numeric = Number(value);
                      onSetMinimumSpend(value === '' || isNaN(numeric) ? null : numeric);
                    }}
                    >
                    <TextField.Slot>
                      <Text weight={'bold'}>$</Text>
                    </TextField.Slot>
                  </TextField.Root>
                </Flex>

                {discountType === 'percent' && (
                  <Flex direction={'column'} gap={'2'}>
                    <Text size={'3'}>Maximum discount (optional)</Text>
                    <Text size={'1'} mt={'-2'}><Em>The max dollar amount that can be discounted from the purchase.</Em></Text>
                    <TextField.Root
                      type="number"
                      placeholder="Maximum discount"
                      value={maxDiscount ?? ''}
                      style={{flexGrow: '1'}}
                      onChange={(e) => {
                        const value = e.target.value;
                        const numeric = Number(value);
                        onSetMaxDiscount(value === '' || isNaN(numeric) ? null : numeric);
                      }}
                      >
                      <TextField.Slot>
                        <Text weight={'bold'}>$</Text>
                      </TextField.Slot>
                    </TextField.Root>
                  </Flex>
                )}
              </Flex>
            )}

            {/* Buttons */}
            <Flex direction="column" gap="3" mt="2">
              <Button
                size="2"
                loading={isSavingReward}
                disabled={!discountAmount}
                onClick={onSave}
              >
                Save Reward
              </Button>

              {isConfigured && (
                <AlertDialog.Root>
                  <AlertDialog.Trigger>
                    <Button variant="ghost" color="red" mt={'4'} loading={isRemovingReward}>
                      Remove Reward
                    </Button>
                  </AlertDialog.Trigger>
                  <AlertDialog.Content maxWidth="450px">
                    <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                    <AlertDialog.Description>
                      This will remove the reward from this achievement. Players who already earned it will still be able to redeem.
                    </AlertDialog.Description>
                    <Flex justify="end" gap="3" mt="4">
                      <AlertDialog.Cancel>
                        <Button variant="soft">Cancel</Button>
                      </AlertDialog.Cancel>
                      <AlertDialog.Action>
                        <Button color="red" onClick={onRemove}>
                          Remove
                        </Button>
                      </AlertDialog.Action>
                    </Flex>
                  </AlertDialog.Content>
                </AlertDialog.Root>
              )}
            </Flex>

            {/* Status messages */}
            {rewardSuccess && (
              <Text size="2" color="green">Reward saved successfully.</Text>
            )}
            {rewardError && (
              <Text size="2" color="red">There was an error saving the reward.</Text>
            )}

          </Flex>
          
          <Flex direction={'column'}>
            <Flex gap="2">
              <Text size="2">Want to build a custom reward?</Text>
              <Link href="mailto:manuel@ggpickleball.co" target="_blank" style={{ color: 'blue', textDecoration: 'underline' }}>
                Contact us
              </Link>
            </Flex>

          </Flex>
          
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
