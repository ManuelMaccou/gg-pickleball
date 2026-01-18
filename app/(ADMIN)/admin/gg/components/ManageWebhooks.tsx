'use client'

import { useState } from 'react';
import { Flex, Card, Button, Text, Heading, TextField, Table, Badge, Code } from '@radix-ui/themes';
import { TrashIcon, ReloadIcon } from '@radix-ui/react-icons';

export default function ManageWebhooks() {
  const [clientId, setClientId] = useState('');
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchWebhooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/webhooks/shopify/manage-webhooks?clientId=${clientId}`);
      const data = await res.json();
      setWebhooks(data || []);
    } catch (e) {
      console.error(e);
      alert("Failed to fetch");
    } finally {
      setLoading(false);
    }
  };

  const deleteWebhook = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    try {
      await fetch(`/api/webhooks/shopify/manage-webhooks`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, webhookId: id }),
      });
      fetchWebhooks();
    } catch (e) {
      alert("Error deleting");
    }
  };

  const registerStandard = async () => {
    setLoading(true);
    try {
        await fetch(`/api/webhooks/shopify/manage-webhooks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientId }),
        });
        alert("Registered!");
        fetchWebhooks();
    } catch (e) {
        alert("Error registering");
    } finally {
        setLoading(false);
    }
  }

  return (
    <Flex direction="column" gap="4" p="5">
      <Heading>Manage Shopify Webhooks</Heading>
      
      <Flex gap="3">
        <TextField.Root 
          placeholder="Client MongoDB ID" 
          value={clientId} 
          onChange={e => setClientId(e.target.value)} 
          style={{ width: 300 }}
        />
        <Button onClick={fetchWebhooks} disabled={loading || !clientId}>
            {loading ? <ReloadIcon className="spin" /> : "Fetch Webhooks"}
        </Button>
         <Button onClick={registerStandard} disabled={loading || !clientId} color="green">
            Register ORDERS_PAID Webhook
        </Button>
      </Flex>

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
                )
            })}
            {webhooks.length === 0 && (
                <Table.Row><Table.Cell colSpan={5}>No webhooks found.</Table.Cell></Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </Card>
      <style>{`.spin { animation: spin 1s linear infinite; } @keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
    </Flex>
  );
}