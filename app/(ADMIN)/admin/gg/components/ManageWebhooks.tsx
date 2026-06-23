'use client'

import { useState } from 'react';
import { Flex, Card, Button, Text, Heading, TextField, Table, Badge, Code, Callout } from '@radix-ui/themes';
import { TrashIcon, ReloadIcon, ExclamationTriangleIcon, InfoCircledIcon } from '@radix-ui/react-icons';

export default function ManageWebhooks() {
  const [clientId, setClientId] = useState('');
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchWebhooks = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/webhooks/shopify/manage-webhooks?clientId=${clientId}`);
      const data = await res.json();
      if (!res.ok) {
        setWebhooks([]);
        throw new Error(data.error || 'Unknown error occurred while fetching webhooks.');
      }
      setWebhooks(data || []);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/webhooks/shopify/manage-webhooks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, webhookId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete webhook.');
      setSuccessMessage("Webhook successfully deleted.");
      fetchWebhooks();
    } catch (e: any) {
      setErrorMessage(e.message);
      setLoading(false);
    }
  };

  const registerWebhooks = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const res = await fetch(`/api/webhooks/shopify/manage-webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to register webhooks.");
      const registered = data.registered?.join(', ') ?? 'unknown';
      setSuccessMessage(`Webhooks registered: ${registered}`);
      fetchWebhooks();
    } catch (e: any) {
      setErrorMessage(e.message);
      setLoading(false);
    }
  };

  return (
    <Flex direction="column" gap="4" p="5">
      <Heading>Manage Shopify Webhooks</Heading>

      <Flex gap="3" align="center">
        <TextField.Root
          placeholder="Client MongoDB ID"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          style={{ width: 300 }}
        />
        <Button onClick={fetchWebhooks} disabled={loading || !clientId}>
          {loading ? <ReloadIcon className="spin" /> : "Fetch Webhooks"}
        </Button>
        <Button onClick={registerWebhooks} disabled={loading || !clientId} color="green">
          Register Webhooks
        </Button>
      </Flex>

      {errorMessage && (
        <Callout.Root color="red" role="alert" style={{ maxWidth: 800 }}>
          <Callout.Icon><ExclamationTriangleIcon /></Callout.Icon>
          <Callout.Text><strong>Error:</strong> {errorMessage}</Callout.Text>
        </Callout.Root>
      )}

      {successMessage && (
        <Callout.Root color="green" style={{ maxWidth: 800 }}>
          <Callout.Icon><InfoCircledIcon /></Callout.Icon>
          <Callout.Text>{successMessage}</Callout.Text>
        </Callout.Root>
      )}

      <Card>
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>Topic</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Filter</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Callback URL</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>Action</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {webhooks.map((edge) => {
              const wh = edge.node;
              return (
                <Table.Row key={wh.id}>
                  <Table.Cell><Badge>{wh.topic}</Badge></Table.Cell>
                  <Table.Cell><Code>{wh.id}</Code></Table.Cell>
                  <Table.Cell>{wh.filter || <Text color="gray">-</Text>}</Table.Cell>
                  <Table.Cell><Text size="1">{wh.endpoint?.callbackUrl}</Text></Table.Cell>
                  <Table.Cell>
                    <Button color="red" variant="soft" onClick={() => deleteWebhook(wh.id)}>
                      <TrashIcon />
                    </Button>
                  </Table.Cell>
                </Table.Row>
              );
            })}
            {webhooks.length === 0 && !loading && !errorMessage && (
              <Table.Row>
                <Table.Cell colSpan={5}>No webhooks found. Enter a Client ID and fetch.</Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Card>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </Flex>
  );
}