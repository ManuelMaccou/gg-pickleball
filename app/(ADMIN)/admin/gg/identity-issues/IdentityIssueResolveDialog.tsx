'use client';

import { useState } from 'react';
import {
  Dialog, Flex, Text, TextField, Button, Callout, Box, Badge, TextArea, Separator,
} from '@radix-ui/themes';
import { ExclamationTriangleIcon, CheckCircledIcon } from '@radix-ui/react-icons';

type ImplicatedUser = {
  _id: string;
  name: string;
  email?: string;
  dupr?: { id?: string };
  identityUnresolved?: boolean;
};

type Attempt = {
  attemptedEmail: string;
  attemptedDuprId: string;
  succeeded: boolean;
  attemptedAt: string;
};

type Issue = {
  _id: string;
  submittedName?: string;
  submittedEmail: string;
  submittedDuprId: string;
  conflictType: 'email_matches_dupr_conflict' | 'dupr_matches_email_conflict' | 'cross_match_conflict';
  implicatedUserIds: ImplicatedUser[]; // populated
  attempts: Attempt[];
  notes?: string;
  status: 'open' | 'resolved';
};

const CONFLICT_LABELS: Record<string, string> = {
  email_matches_dupr_conflict: "Email matches, DUPR ID doesn't",
  dupr_matches_email_conflict: "DUPR ID matches, email doesn't",
  cross_match_conflict: 'Email and DUPR ID belong to different accounts',
};

// [Identity reconciliation] The explanatory text, not the underlying
// check — same reconcilePlayerIdentity function runs regardless of which
// message this produces. cross_match_conflict relies on implicatedUserIds
// being in [emailHolder, duprHolder] order, exactly as
// reconcilePlayerIdentity.ts returns it.
function getConflictExplanation(
  conflictType: string,
  users: ImplicatedUser[],
  submittedEmail: string,
  submittedDuprId: string
): string {
  if (conflictType === 'email_matches_dupr_conflict') {
    const user = users[0];
    const currentDupr = user?.dupr?.id;
    return `The email "${submittedEmail}" already belongs to ${user?.name ?? 'an existing account'}, but that account's DUPR ID is ${currentDupr ? `"${currentDupr}"` : 'not on file'} — not "${submittedDuprId}" from this upload. This can happen if the player never connected DUPR, connected it after this tournament, or the ID was mistyped.`;
  }
  if (conflictType === 'dupr_matches_email_conflict') {
    const user = users[0];
    return `The DUPR ID "${submittedDuprId}" already belongs to ${user?.name ?? 'an existing account'} (${user?.email ?? 'no email on file'}), but this upload lists a different email: "${submittedEmail}". This often means the player used a different email for tournament registration than their account email.`;
  }
  if (conflictType === 'cross_match_conflict') {
    const [emailUser, duprUser] = users;
    return `The email "${submittedEmail}" belongs to ${emailUser?.name ?? 'one account'}, but the DUPR ID "${submittedDuprId}" belongs to a DIFFERENT account, ${duprUser?.name ?? 'another account'}. Both accounts are flagged until this is resolved.`;
  }
  return 'This row conflicts with existing account data.';
}

export function IdentityIssueResolveDialog({
  issue,
  open,
  onOpenChange,
  onResolved,
}: {
  issue: Issue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolved: () => void;
}) {
  // Pre-fill from the latest logged attempt if one exists, otherwise the
  // originally-submitted CSV values — this is the "show me what was last
  // tried" behavior, sourced from the immutable attempt log rather than
  // any mutated field on the issue itself.
  const latestAttempt = issue.attempts.length > 0 ? issue.attempts[issue.attempts.length - 1] : null;

  const [email, setEmail] = useState(latestAttempt?.attemptedEmail ?? issue.submittedEmail);
  const [duprId, setDuprId] = useState(latestAttempt?.attemptedDuprId ?? issue.submittedDuprId);
  const [notes, setNotes] = useState(issue.notes ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [attemptError, setAttemptError] = useState<{ conflictType: string; users: ImplicatedUser[] } | null>(null);
  const [genericError, setGenericError] = useState<string | null>(null);

  const originalExplanation = getConflictExplanation(
    issue.conflictType,
    issue.implicatedUserIds,
    issue.submittedEmail,
    issue.submittedDuprId
  );

  const latestAttemptExplanation = attemptError
    ? getConflictExplanation(attemptError.conflictType, attemptError.users, email, duprId)
    : null;

  const handleSaveNotes = async () => {
    if (notes === (issue.notes ?? '')) return; // nothing changed
    setSavingNotes(true);
    try {
      await fetch(`/api/admin/player-identity-issues/${issue._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
    } catch (e) {
      console.error('[IdentityIssueResolveDialog] Failed to save notes:', e);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleConfirm = async () => {
    if (!email.trim() || !duprId.trim()) return;
    setSubmitting(true);
    setAttemptError(null);
    setGenericError(null);
    try {
      const res = await fetch(`/api/admin/player-identity-issues/${issue._id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), duprId: duprId.trim() }),
      });
      const data = await res.json();

      if (res.ok && data.resolved) {
        onResolved();
        onOpenChange(false);
        return;
      }

      if (res.status === 409) {
        setAttemptError({ conflictType: data.conflictType, users: data.implicatedUsers ?? [] });
      } else {
        setGenericError(data.error || 'Something went wrong. Please try again.');
      }
    } catch (e) {
      console.error('[IdentityIssueResolveDialog] Resolve failed:', e);
      setGenericError('Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title>Resolve identity conflict</Dialog.Title>

        <Flex direction="column" gap="4" mt="3">
          <Badge color="amber" variant="soft" style={{ alignSelf: 'flex-start' }}>
            {CONFLICT_LABELS[issue.conflictType] ?? issue.conflictType}
          </Badge>

          {issue.submittedName && (
            <Text size="2" color="gray">
              Player name on file: <Text weight="bold">{issue.submittedName}</Text>
            </Text>
          )}

          <Callout.Root color="gray" size="1">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>{originalExplanation}</Callout.Text>
          </Callout.Root>

          <Flex direction="column" gap="1">
            <Text as="div" size="2" weight="bold">Email</Text>
            <TextField.Root
              value={email}
              onChange={(e) => { setEmail(e.target.value); setAttemptError(null); setGenericError(null); }}
              placeholder="player@email.com"
            />
          </Flex>

          <Flex direction="column" gap="1">
            <Text as="div" size="2" weight="bold">DUPR ID</Text>
            <TextField.Root
              value={duprId}
              onChange={(e) => { setDuprId(e.target.value); setAttemptError(null); setGenericError(null); }}
              placeholder="DUPR ID"
            />
          </Flex>

          <Text size="1" color="gray">
            This only succeeds if both fields match nothing on file (a new account is
            created), or both match the exact same existing account. An existing
            account's email can never be overwritten from here.
          </Text>

          {attemptError && (
            <Callout.Root color="red" size="1">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{latestAttemptExplanation}</Callout.Text>
            </Callout.Root>
          )}

          {genericError && (
            <Callout.Root color="red" size="1">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{genericError}</Callout.Text>
            </Callout.Root>
          )}

          <Separator size="4" />

          <Flex direction="column" gap="1">
            <Text as="div" size="2" weight="bold">Notes</Text>
            <TextArea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="e.g. Emailed player 8/20, waiting on reply"
              rows={2}
            />
            {savingNotes && <Text size="1" color="gray">Saving…</Text>}
          </Flex>

          {issue.attempts.length > 0 && (
            <Flex direction="column" gap="2">
              <Text as="div" size="2" weight="bold">
                Previous attempts ({issue.attempts.length})
              </Text>
              <Flex direction="column" gap="1" style={{ maxHeight: 140, overflowY: 'auto' }}>
                {[...issue.attempts].reverse().map((a, i) => (
                  <Flex key={i} align="center" gap="2">
                    {a.succeeded
                      ? <CheckCircledIcon color="var(--green-9)" width={14} height={14} />
                      : <ExclamationTriangleIcon color="var(--amber-9)" width={14} height={14} />}
                    <Text size="1" color="gray">
                      {new Date(a.attemptedAt).toLocaleDateString()} — {a.attemptedEmail} / {a.attemptedDuprId}
                      {a.succeeded ? ' — succeeded' : ' — failed'}
                    </Text>
                  </Flex>
                ))}
              </Flex>
            </Flex>
          )}

          <Flex gap="3" justify="end" mt="2">
            <Dialog.Close>
              <Button variant="soft" color="gray">Cancel</Button>
            </Dialog.Close>
            <Button onClick={handleConfirm} disabled={submitting || !email.trim() || !duprId.trim()}>
              {submitting ? 'Checking…' : 'Confirm'}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}