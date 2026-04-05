'use client';

import { useState } from 'react';
import { Flex, Card, Heading, Text, Button, TextArea, TextField, Callout, Spinner } from '@radix-ui/themes';
import { InfoCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

export default function Auth0CleanupPage() {
  const [excludedInput, setExcludedInput] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ deletedCount: number, skippedCount: number } | null>(null);
  const [error, setError] = useState('');

  const handleCleanup = async () => {
    if (confirmation !== 'DELETE') return;
    
    setLoading(true);
    setError('');
    setResult(null);

    // Parse emails from textarea (split by comma or newline)
    const excludedEmails = excludedInput
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0);

    try {
      const res = await fetch('/api/admin-tasks/auth0-cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ excludedEmails })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to clean up users');

      setResult({
          deletedCount: data.deletedCount,
          skippedCount: data.skippedCount
      });
      setConfirmation(''); // Reset confirmation lock
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex direction="column" align="center" p="6">
      <Card size="4" style={{ maxWidth: 600, width: '100%' }}>
        <Flex direction="column" gap="4">
          <Heading size="6" color="red">Auth0 User Cleanup (Danger Zone)</Heading>
          
          <Callout.Root color="red" role="alert">
            <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
            <Callout.Text>
              This action will permanently delete users from your Auth0 tenant. This cannot be undone. 
              <strong> Note: This does NOT delete their records in your MongoDB database.</strong>
            </Callout.Text>
          </Callout.Root>

          <Flex direction="column" gap="2">
            <Text weight="bold">Emails to KEEP (Safe List)</Text>
            <Text size="2" color="gray">
              Enter the emails of the users you do NOT want to delete. Separate by commas or new lines. 
              Leave this completely blank to delete ALL users.
            </Text>
            <TextArea 
              placeholder="admin@ggpickleball.com&#10;test@example.com" 
              value={excludedInput}
              onChange={(e) => setExcludedInput(e.target.value)}
              rows={6}
            />
          </Flex>

          <Flex direction="column" gap="2" mt="4" p="4" style={{ backgroundColor: 'var(--red-2)', borderRadius: '8px' }}>
            <Text weight="bold" color="red">Type "DELETE" to confirm</Text>
            <TextField.Root 
                placeholder="DELETE" 
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                color="red"
            />
            <Button 
                color="red" 
                variant="solid" 
                size="3" 
                mt="2"
                disabled={confirmation !== 'DELETE' || loading}
                onClick={handleCleanup}
            >
              {loading ? <Spinner /> : 'Permanently Delete Auth0 Users'}
            </Button>
          </Flex>

          {error && (
            <Callout.Root color="red">
              <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          {result && (
            <Callout.Root color="green">
              <Callout.Icon><InfoCircledIcon /></Callout.Icon>
              <Callout.Text>
                <strong>Cleanup Complete!</strong><br/>
                Deleted Users: {result.deletedCount}<br/>
                Kept Users: {result.skippedCount}
              </Callout.Text>
            </Callout.Root>
          )}

        </Flex>
      </Card>
    </Flex>
  );
}