import { IAchievementCategory, IClient } from "@/app/types/databaseTypes";
import { Cross1Icon } from "@radix-ui/react-icons";
import { AlertDialog, Badge, Button, Dialog, Em, Flex, Text } from "@radix-ui/themes";

interface MobileAchievementDetailsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCategory: IAchievementCategory | null;
  isSelectedCategoryActive: boolean;
  isRemovingCategoryAchievements: boolean;
  isSettingCategoryAchievements: boolean;
  location: IClient | null;
  onActivate: () => void;
  onDeactivate: () => void;
}

export default function MobileAchievementDetails({
  open,
  onOpenChange,
  selectedCategory,
  isSelectedCategoryActive,
  isRemovingCategoryAchievements,
  isSettingCategoryAchievements,
  location,
  onActivate,
  onDeactivate,
}: MobileAchievementDetailsProps) {
  if (!selectedCategory) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content style={{height: '500px'}}>
        <Dialog.Close>
          <Flex direction={'row'} justify={'end'} align={'center'} mb={'4'}>
            <Cross1Icon height={'20px'} width={'20px'}/>
          </Flex>
          
        </Dialog.Close>
        <Dialog.Title>{selectedCategory.name}</Dialog.Title>
        <Dialog.Description style={{ marginBottom: '1rem' }}>
          {selectedCategory.description}
        </Dialog.Description>

        {selectedCategory && selectedCategory.milestones && selectedCategory.milestones?.length > 0 && (
          <Flex direction={'column'}>
            <Text size="3" weight="bold">Available milestones</Text>
            <Text size="1" style={{marginBottom: '20px'}}><Em>Not every milestone has to be rewarded</Em></Text>
            <Flex gap="2" wrap="wrap" mb={'4'}>
              {selectedCategory.milestones.map((milestone, index) => (
                <Badge key={index} size="3" color="green">
                  {milestone}
                </Badge>
              ))}
            </Flex>
          </Flex>
        )}

        <Flex direction="column" mt="4" gap="2">
          {isSelectedCategoryActive ? (
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button variant="soft" color="red" loading={isRemovingCategoryAchievements}>
                  Deactivate
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="450px">
                <AlertDialog.Title>Are you sure?</AlertDialog.Title>
                <AlertDialog.Description>
                  All achievements and their associated rewards will be deactivated.
                </AlertDialog.Description>
                <Flex gap="4" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button color="red" onClick={onDeactivate}>Deactivate</Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          ) : (
            <Button disabled={!location} loading={isSettingCategoryAchievements} onClick={onActivate}>
              Activate
            </Button>
          )}
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
