// Destination: app/(BRAND)/admin/brand/rewards/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useUserContext } from '@/app/contexts/UserContext';
import {
  Flex, Text, Heading, Button, Spinner,
  IconButton, AlertDialog,
  Box, ScrollArea, Badge,
} from '@radix-ui/themes';
import {
  CheckCircledIcon, InfoCircledIcon, MagicWandIcon,
  TrashIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon,
} from '@radix-ui/react-icons';
import {
  AdminPermissionType,
  IAchievement, IClient, IReward, ISourceRewardSponsorship,
} from '@/app/types/databaseTypes';
import { useIsMobile } from '@/app/hooks/useIsMobile';
import { BrandPageShell } from '../../components/BrandPageShell';
import {
  DEFAULT_DISCOUNT_FORM_STATE,
  DiscountFormState,
  buildRewardPayloadFields,
  discountFormStateFromReward,
  targetSummaryText,
  validateDiscountForm,
} from '@/lib/rewards/discountFormState';
import { RewardDiscountForm } from '../../components/RewardDiscountForm';

// --- TYPES ---
type ClientSideSourceConfig = {
  achievementName: string;
  sponsorships: ISourceRewardSponsorship[];
};

export default function BrandRewardConfigPage() {
  const { user } = useUserContext();
  const userId = user?.id;

  // --- STATE ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Data
  const [location, setLocation] = useState<IClient | null>(null);
  const [allAchievements, setAllAchievements] = useState<IAchievement[]>([]);
  const [allRewards, setAllRewards] = useState<IReward[]>([]);

  const [sourceConfigs, setSourceConfigs] = useState<ClientSideSourceConfig[]>([]);
  const [adminPermission, setAdminPermission] = useState<AdminPermissionType>(null);

  // UI State
  const [selectedAchievement, setSelectedAchievement] = useState<IAchievement | null>(null);
  const [searchQuery] = useState('');
  // Desktop-only: controls the achievement-picker overlay drawer. Starts
  // open so there's something to pick from on first load. Mobile ignores
  // this entirely and keeps its own full-screen list/canvas swap.
  const [achievementDrawerOpen, setAchievementDrawerOpen] = useState(true);

  // Form State — discount mechanics (amount off / BXGY) live in one object.
  const [discountForm, setDiscountForm] = useState<DiscountFormState>(DEFAULT_DISCOUNT_FORM_STATE);

  const [existingRewardId, setExistingRewardId] = useState<string | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [isGettingAdmin, setIsGettingAdmin] = useState(true);

  const isMobile = useIsMobile();

  // --- 0. GET ADMIN PERMISSIONS ---
  useEffect(() => {
    if (!userId) return;

    const getAdminUser = async () => {
      setAdminError(null);
      try {
        const response = await fetch(`/api/admin?userId=${userId}`);

        if (response.status === 204) {
          setAdminError("You don't have permission to access this page.");
          setIsGettingAdmin(false);
          return;
        }

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to fetch admin data');

        if (data.admin.permission) setAdminPermission(data.admin.permission);
        setLocation(data.admin.location);
      } catch (err: unknown) {
        console.error('Error fetching admin data:', err);
        setAdminError(err instanceof Error ? err.message : 'Unknown error occurred');
      } finally {
        setIsGettingAdmin(false);
      }
    };

    getAdminUser();
  }, [userId]);

  // --- 1. FETCH GLOBAL CONTEXT DATA ---
  useEffect(() => {
    const init = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        const [achRes, rewardRes] = await Promise.all([
          fetch('/api/achievement/category/scope?scope=global'),
          fetch('/api/reward'),
        ]);

        const achievementsData = await achRes.json();
        const rewardsData = await rewardRes.json();

        setAllAchievements(achievementsData.achievements || []);
        setAllRewards(rewardsData.rewards || []);

      } catch (err) {
        console.error(err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, [user]);

  // --- 2. FETCH CONFIGS ---
  useEffect(() => {

    const fetchConfigs = async () => {
      try {
        const res = await fetch('/api/source-reward-config');
        const data = await res.json();

        if (res.ok) {
          const groupedConfigs: Record<string, ClientSideSourceConfig> = {};

          for (const reward of (data.rewards || [])) {
            const achName = reward.achievement.name;
            if (!groupedConfigs[achName]) {
              groupedConfigs[achName] = {
                achievementName: achName,
                sponsorships: [],
              };
            }
            groupedConfigs[achName].sponsorships.push({
              sponsoringClientId: reward.sponsoringClient._id,
              rewardId: reward.reward._id,
            });
          }
          setSourceConfigs(Object.values(groupedConfigs));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchConfigs();
  }, [isSaving, isRemoving]);

  // --- 3. POPULATE FORM ON SELECTION ---
  useEffect(() => {
    if (!selectedAchievement || !location) return;

    const config = sourceConfigs.find((c) => c.achievementName === selectedAchievement.name);
    const sponsorship = config?.sponsorships?.find(
      (s) => s.sponsoringClientId.toString() === location._id.toString()
    );

    if (sponsorship) {
      const reward = allRewards.find((r) => r._id.toString() === sponsorship.rewardId.toString());
      if (reward) {
        setExistingRewardId(reward._id.toString());
        setDiscountForm(discountFormStateFromReward(reward));
        return;
      }
    }

    setExistingRewardId(null);
    setDiscountForm(DEFAULT_DISCOUNT_FORM_STATE);
  }, [selectedAchievement, location, sourceConfigs, allRewards]);

  // --- SAVE HANDLER ---
  const handleSave = async () => {
    if (!selectedAchievement || !location) return;

    const validationError = validateDiscountForm(discountForm);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      let friendlyName: string;
      let rawSlug: string;

      if (discountForm.discountKind === 'bxgy') {
        const off = discountForm.getPercent === 100 ? 'free' : `${discountForm.getPercent}% off`;
        friendlyName = `Buy ${discountForm.buyQuantity}, get ${discountForm.getQuantity} ${off}`;
        rawSlug = `buy-${discountForm.buyQuantity}-get-${discountForm.getQuantity}-${
          discountForm.getPercent === 100 ? 'free' : `${discountForm.getPercent}-percent-off`
        }`;
      } else {
        // Built from the actual scope, not a free-text field — this can't
        // drift out of sync with what the code actually sends to Shopify,
        // unlike the old productDescription-based name.
        const scopeLabel =
          discountForm.scope === 'store' ? 'Entire Order' : targetSummaryText(discountForm.scopeSelection);
        friendlyName = `${discountForm.amountType === 'dollars' ? '$' : ''}${discountForm.amountValue}${
          discountForm.amountType === 'percent' ? '%' : ''
        } off ${scopeLabel}`;
        rawSlug = `${discountForm.amountValue}-${discountForm.amountType}-off-${scopeLabel}`;
      }
      const name = rawSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      const rewardPayload: Partial<IReward> = {
        friendlyName,
        name,
        category: 'retail',
        product: 'online store',
        ...buildRewardPayloadFields(discountForm),
      };

      let finalRewardObj: IReward;

      if (existingRewardId) {
        const updateRes = await fetch('/api/reward', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...rewardPayload, id: existingRewardId }),
        });

        const updateData = await updateRes.json();
        if (!updateRes.ok) throw new Error(updateData.error || 'Failed to update reward.');
        finalRewardObj = updateData.reward;
      } else {
        const createRes = await fetch('/api/reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rewardPayload),
        });

        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Failed to create reward.');
        finalRewardObj = createData.reward;

        const configPayload = {
          achievementName: selectedAchievement.name,
          sponsorship: {
            sponsoringClientId: location._id,
            rewardId: finalRewardObj._id,
          },
        };

        const configRes = await fetch('/api/source-reward-config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configPayload),
        });

        if (!configRes.ok) throw new Error('Failed to link reward.');
      }

      const finalRewardId = finalRewardObj._id;

      setAllRewards((prev) => {
        const exists = prev.findIndex((r) => r._id === finalRewardId);
        if (exists > -1) {
          const next = [...prev];
          next[exists] = finalRewardObj;
          return next;
        }
        return [...prev, finalRewardObj];
      });

      setSourceConfigs((prev) => {
        const next = [...prev];
        const configIndex = next.findIndex((c) => c.achievementName === selectedAchievement?.name);
        const newSponsorship = { sponsoringClientId: location._id, rewardId: finalRewardId };

        if (configIndex > -1) {
          const existingSponsorshipIndex = next[configIndex].sponsorships.findIndex(
            (s) => s.sponsoringClientId.toString() === location._id.toString()
          );
          if (existingSponsorshipIndex > -1) {
            next[configIndex].sponsorships[existingSponsorshipIndex] = newSponsorship;
          } else {
            next[configIndex].sponsorships.push(newSponsorship);
          }
        } else {
          next.push({
            achievementName: selectedAchievement!.name,
            sponsorships: [newSponsorship],
          });
        }
        return next;
      });

      setExistingRewardId(finalRewardId.toString());
      setSuccessMsg(existingRewardId ? 'Reward updated successfully.' : 'Reward created successfully.');

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- REMOVE HANDLER ---
  const handleRemove = async () => {
    if (!existingRewardId || !selectedAchievement || !location) return;
    setIsRemoving(true);

    try {
      const res = await fetch('/api/source-reward-config', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          achievementName: selectedAchievement.name,
          rewardId: existingRewardId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to remove sponsorship');
      }

      setSourceConfigs((prev) => {
        const next = [...prev];
        const configIndex = next.findIndex((c) => c.achievementName === selectedAchievement.name);
        if (configIndex > -1) {
          next[configIndex].sponsorships = next[configIndex].sponsorships.filter(
            (s) => s.rewardId.toString() !== existingRewardId
          );
        }
        return next;
      });

      setSuccessMsg('Reward removed.');
      setExistingRewardId(null);
      setDiscountForm(DEFAULT_DISCOUNT_FORM_STATE);

      if (isMobile) {
        setTimeout(() => setSelectedAchievement(null), 1500);
      }

      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove reward');
    } finally {
      setIsRemoving(false);
    }
  };

  useEffect(() => {
    setSuccessMsg(null);
    setError(null);
  }, [selectedAchievement]);

  // Escape closes the achievement drawer, matching modal conventions —
  // this is a lightweight overlay, not a full Radix Dialog, so there's no
  // built-in focus trap here; add one later if that turns out to matter.
  useEffect(() => {
    if (isMobile || !achievementDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAchievementDrawerOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobile, achievementDrawerOpen]);

  const filteredAchievements = useMemo(() => {
    return allAchievements.filter((a) =>
      a.friendlyName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [allAchievements, searchQuery]);

  // Minimal gate on the button itself — mirrors the previous page's
  // approach of only disabling on the most basic missing field. The
  // fuller validation (empty scope/buys/gets selections, percent > 100,
  // etc.) runs in handleSave via validateDiscountForm and surfaces as a
  // Callout, same layering as before.
  const isSaveDisabled =
    discountForm.discountKind === 'amount'
      ? !discountForm.amountValue
      : !discountForm.buyQuantity || !discountForm.getQuantity || !discountForm.getPercent;

  // --- LAYOUT LOGIC ---
  // Desktop: the achievement list is now an overlay drawer, not an in-flow
  // sidebar, so the detail canvas always renders at full width and never
  // resizes when the drawer opens or closes.
  // Mobile: unchanged — a real screen-size constraint, not a preference —
  // keeps the original full-screen swap between list and canvas.
  const showMobileList = isMobile && !selectedAchievement;
  const showMobileCanvas = isMobile && !!selectedAchievement;

  if (isMobile === null || isLoading || isGettingAdmin) {
    return (
      <Flex justify="center" align="center" height="100vh">
        <Spinner size="3" />
      </Flex>
    );
  }

  if (adminError) {
    return (
      <Flex direction="column" height="100vh" align="center" justify="center" gap="4">
        <Text color="red" size="4">{adminError}</Text>
        <Button onClick={() => (window.location.href = '/')}>Go Home</Button>
      </Flex>
    );
  }

  if (!location) {
    return (
      <BrandPageShell adminPermission={adminPermission} location={null}>
        <Flex direction="column" align="center" justify="center" flexGrow="1">
          <Heading mb="2">Access Denied</Heading>
          <Text color="gray">
            You do not have a client configuration associated with your account.
          </Text>
        </Flex>
      </BrandPageShell>
    );
  }

  if (user && adminPermission !== 'admin') {
    return (
      <BrandPageShell adminPermission={adminPermission} location={location}>
        <Flex direction="column" align="center" justify="center" height="300px">
          <Text>You do not have access to this page</Text>
        </Flex>
      </BrandPageShell>
    );
  }

  // Shared between the mobile in-flow panel and the desktop overlay drawer
  // — only the outer wrapper differs between the two. Declared here (after
  // every early-return guard) so `location` is narrowed to non-null by TS,
  // same as the JSX below already relied on before this restructuring.
  const achievementListInner = (
    <>
      <Flex justify="between" align="center" px="4" py="4" style={{ borderBottom: '1px solid var(--gray-4)' }}>
        <Box>
          <Heading size="4">Configure Rewards</Heading>
          <Text size="2" color="gray">
            Select an achievement to configure its reward.
          </Text>
        </Box>
        {!isMobile && (
          <IconButton
            variant="ghost"
            color="gray"
            onClick={() => setAchievementDrawerOpen(false)}
            style={{ cursor: 'pointer', flexShrink: 0 }}
          >
            <Cross2Icon />
          </IconButton>
        )}
      </Flex>

      <ScrollArea type="hover" scrollbars="vertical" style={{ flex: 1, minHeight: 0 }}>
        <Flex direction="column" p="2">
          {filteredAchievements.map((ach) => {
            const configForAch = sourceConfigs.find((c) => c.achievementName === ach.name);
            const isSponsored = configForAch?.sponsorships?.some(
              (s) => s.sponsoringClientId.toString() === location?._id.toString()
            );
            const isSelected = selectedAchievement?._id === ach._id;

            return (
              <Button
                key={ach._id.toString()}
                variant="ghost"
                color="gray"
                onClick={() => {
                  setSelectedAchievement(ach);
                  // No-op on mobile (drawer state is unused there), and
                  // closes the drawer on desktop — same click, both cases.
                  setAchievementDrawerOpen(false);
                }}
                style={{
                  justifyContent: 'space-between',
                  height: 'auto',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  backgroundColor: isSelected && !isMobile ? 'var(--accent-3)' : 'transparent',
                  color: isSelected && !isMobile ? 'var(--accent-11)' : 'var(--gray-12)',
                  marginBottom: '4px',
                  cursor: 'pointer',
                }}
              >
                <Flex align="center" gap="3">
                  <Box
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: isSponsored ? 'var(--green-9)' : 'var(--gray-5)',
                      flexShrink: 0,
                    }}
                  />
                  <Flex direction="column" align="start">
                    <Text weight={isSelected && !isMobile ? 'bold' : 'medium'} size="2">
                      {ach.friendlyName}
                    </Text>
                    <Text size="1" color={isSelected && !isMobile ? undefined : 'gray'}>
                      {ach.name.length > 30 ? ach.name.substring(0, 30) + '...' : ach.name}
                    </Text>
                  </Flex>
                </Flex>

                <Flex align="center" gap="2">
                  {isSponsored && !isMobile && <CheckCircledIcon color="green" />}
                  {isMobile && <ChevronRightIcon color="gray" />}
                </Flex>
              </Button>
            );
          })}
        </Flex>
      </ScrollArea>
    </>
  );

  const detailCanvasContent = selectedAchievement ? (
    // Widened from the old single-column layout's 800px — the discount
    // form is a two-pane (form + sticky preview) layout that needs the room.
    <Flex direction="column"  width="100%" gap="6">
      <Button
        variant="ghost"
        color="gray"
        onClick={() => (isMobile ? setSelectedAchievement(null) : setAchievementDrawerOpen(true))}
        style={{ alignSelf: 'flex-start', padding: 0 }}
      >
        <ChevronLeftIcon width="20" height="20" /> Browse achievements
      </Button>

      <Flex
        justify="between"
        align="center"
        direction={{ initial: 'column', xs: 'row' }}
        gap="2"
        style={{
          alignItems: isMobile ? 'flex-start' : 'center',
          position: 'sticky',
          top: -35,
          zIndex: 10,
          // Matches BrandPageShell's canvas background — needed so content
          // scrolling underneath doesn't show through while this is stuck.
          // Coupled to that value on purpose for now; revisit if the shell
          // ever exposes its background as something other than a literal.
          backgroundColor: '#F9FAFB',
          paddingTop: 12,
          paddingBottom: 12,
          borderBottom: '1px solid var(--gray-4)',
        }}
      >
        <Box>
          <Heading size="6" mb="1" style={{ color: 'var(--slate-12)' }}>
            {selectedAchievement.friendlyName}
          </Heading>
          <Text size="2" color="gray">
            Configure the reward players receive when earning this achievement.
          </Text>
        </Box>
        <Flex justify="between" align="center" wrap="wrap" gap="3">
          {existingRewardId ? (
            <AlertDialog.Root>
              <AlertDialog.Trigger>
                <Button radius="full" variant="soft" color="red" disabled={isRemoving} loading={isRemoving}>
                  <TrashIcon /> Remove Reward
                </Button>
              </AlertDialog.Trigger>
              <AlertDialog.Content maxWidth="420px">
                <AlertDialog.Title>Remove this reward?</AlertDialog.Title>
                <AlertDialog.Description size="2">
                  This removes the reward from <strong>{selectedAchievement?.friendlyName}</strong>.
                  Codes already issued to players are unaffected. This only stops new codes from being issued, and can't be undone.
                </AlertDialog.Description>
                <Flex gap="3" mt="4" justify="end">
                  <AlertDialog.Cancel>
                    <Button variant="soft" color="gray">Cancel</Button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action>
                    <Button variant="solid" color="red" onClick={handleRemove}>
                      Remove Reward
                    </Button>
                  </AlertDialog.Action>
                </Flex>
              </AlertDialog.Content>
            </AlertDialog.Root>
          ) : (
            <Box />
          )}

          <Button
            onClick={handleSave}
            loading={isSaving}
            disabled={isSaveDisabled}
            color='lime'
            radius="full"
          >
            {existingRewardId ? 'Save Changes' : 'Create Reward'}
          </Button>
        </Flex>
      </Flex>

      <Flex direction="column" gap="5" width="100%">
        <RewardDiscountForm
          clientId={location._id.toString()}
          value={discountForm}
          onChange={(patch) => setDiscountForm((prev) => ({ ...prev, ...patch }))}
          editingLive={!!existingRewardId}
          cardBackgroundImage={location.cardBackgroundImage}
          cardBackgroundPosition={location.cardBackgroundPosition}
          cardTextColor={location.cardTextColor}
        />
      </Flex>
    </Flex>
  ) : (
    <Flex direction="column" align="center" justify="center" height="100%" gap="3">
      <Box style={{ opacity: 0.4 }}>
        <MagicWandIcon width="64" height="64" />
      </Box>
      <Heading size="6" color="gray">Select an Achievement</Heading>
      <Text color="gray">
        {isMobile
          ? 'Choose an item from the list to configure rewards.'
          : 'Browse your achievements to configure a reward.'}
      </Text>
      {/* Fallback for the edge case where someone closes the drawer via
          backdrop/Escape before ever picking anything — otherwise there'd
          be no way back in, since the drawer no longer opens automatically
          once it's been dismissed once. */}
      {!isMobile && (
        <Button mt="2" onClick={() => setAchievementDrawerOpen(true)}>
          Browse achievements
        </Button>
      )}
    </Flex>
  );

  return (
    <BrandPageShell
      adminPermission={adminPermission}
      location={location}
      contentMaxWidth="none"
      contentPadding="0"
    >
      <Flex style={{ height: '100%', position: 'relative' }}>
        {/* Save/remove confirmation toast — success reuses successMsg's
            existing 3s auto-clear from handleSave/handleRemove; error
            deliberately does NOT auto-dismiss (it never did before this
            toast existed either — errors are worth reading, not worth
            racing a timer for), so it gets its own close button instead.
            z-index 100 sits above the achievement drawer (40/41) in case
            a save happens while it's open. Centering is via left/right/
            margin rather than a CSS transform, since motion already owns
            the transform property for the y animation — mixing the two
            would have one silently clobber the other. */}
        <AnimatePresence>
          {(successMsg || error) && (
            <motion.div
              key="save-toast"
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'fixed',
                top: 76,
                left: 0,
                right: 0,
                width: 'fit-content',
                maxWidth: '90vw',
                margin: '0 auto',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                backgroundColor: error ? '#3a1414' : '#111',
                border: error ? '1px solid rgba(239,68,68,0.35)' : 'none',
                padding: '10px 14px 10px 20px',
                borderRadius: 999,
                boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
              }}
            >
              {error ? (
                <InfoCircledIcon style={{ color: '#f87171', flexShrink: 0 }} />
              ) : (
                <CheckCircledIcon style={{ color: '#a3e635', flexShrink: 0 }} />
              )}
              <Text size="2" style={{ color: '#fff' }}>{error || successMsg}</Text>
              {error && (
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  onClick={() => setError(null)}
                  style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
                >
                  <Cross2Icon width="14" height="14" />
                </IconButton>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {isMobile ? (
          <>
            {/* --- MOBILE: full-screen swap between list and canvas, unchanged --- */}
            {showMobileList && (
              <Flex direction="column" width="100%" style={{ backgroundColor: 'white' }}>
                {achievementListInner}
              </Flex>
            )}
            {showMobileCanvas && (
              <Flex
                flexGrow="1"
                justify="center"
                style={{ overflowY: 'auto', position: 'relative' }}
                p={{ initial: '4', md: '6' }}
              >
                {detailCanvasContent}
              </Flex>
            )}
          </>
        ) : (
          <>
            {/* --- DESKTOP: canvas always full width; list is an overlay drawer --- */}
            <Flex
              flexGrow="1"
              justify="center"
              style={{ overflowY: 'auto', position: 'relative' }}
              p={{ initial: '4', md: '6' }}
            >
              {detailCanvasContent}
            </Flex>

            <AnimatePresence>
              {achievementDrawerOpen && (
                <>
                  <motion.div
                    key="achievement-drawer-backdrop"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={() => setAchievementDrawerOpen(false)}
                    style={{
                      position: 'fixed',
                      top: 64,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(15,23,42,0.45)',
                      zIndex: 40,
                    }}
                  />
                  <motion.div
                    key="achievement-drawer"
                    initial={{ x: '-100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '-100%' }}
                    transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
                    style={{
                      position: 'fixed',
                      top: 64,
                      left: 0,
                      bottom: 0,
                      width: 320,
                      backgroundColor: 'white',
                      borderRight: '1px solid var(--gray-4)',
                      boxShadow: '4px 0 24px rgba(0,0,0,0.12)',
                      zIndex: 41,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {achievementListInner}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </>
        )}
      </Flex>
    </BrandPageShell>
  );
}