'use client';

import { useEffect, useRef, useState } from 'react';
import { Box, Flex, Spinner, Text, IconButton } from '@radix-ui/themes';
import { Cross2Icon, MagnifyingGlassIcon, PersonIcon } from '@radix-ui/react-icons';

export interface DuprPlayerResult {
  duprId: string;
  fullName: string;
  doublesRating: number | null;
}

interface DuprPlayerSearchProps {
  onSelect: (player: DuprPlayerResult | null) => void;
  selected: DuprPlayerResult | null;
  // When provided, shows a "Browse club members" option.
  clubId?: string;
  placeholder?: string;
  disabled?: boolean;
}

const DEBOUNCE_MS = 400;
const MIN_CHARS = 3;

type Mode = 'search' | 'browse';

export function DuprPlayerSearch({
  onSelect,
  selected,
  clubId,
  placeholder = 'Search by name…',
  disabled = false,
}: DuprPlayerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DuprPlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  // Browse mode state
  const [mode, setMode] = useState<Mode>('search');
  const [members, setMembers] = useState<DuprPlayerResult[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersFetched, setMembersFetched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search.
  useEffect(() => {
    if (mode !== 'search') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.length < MIN_CHARS) {
      setResults([]);
      setOpen(false);
      setSearchError(null);
      return;
    }

    setSearching(true);
    setSearchError(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/dupr/search-users?query=${encodeURIComponent(query)}`
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Search failed');
        setResults(data.hits ?? []);
        setOpen(true);
      } catch (e) {
        setSearchError(e instanceof Error ? e.message : 'Search failed');
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  // Lazy fetch club members when browse mode is activated.
  const handleBrowseClick = async () => {
    setMode('browse');
    setOpen(true);

    if (membersFetched) return; // Already loaded — just open.

    setMembersLoading(true);
    setMembersError(null);
    try {
      const res = await fetch(`/api/dupr/club-members?clubId=${clubId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to load members');
      setMembers(data.members ?? []);
      setMembersFetched(true);
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : 'Failed to load members');
    } finally {
      setMembersLoading(false);
    }
  };

  const handleBackToSearch = () => {
    setMode('search');
    setOpen(false);
  };

  const handleSelect = (player: DuprPlayerResult) => {
    onSelect(player);
    setQuery('');
    setResults([]);
    setOpen(false);
    setMode('search');
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setResults([]);
    setOpen(false);
    setMode('search');
  };

  const renderPlayerRow = (player: DuprPlayerResult) => (
    <Flex
      key={player.duprId}
      align="center"
      justify="between"
      onClick={() => handleSelect(player)}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: '1px solid var(--gray-3)',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--gray-2)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'white')}
    >
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{player.fullName}</Text>
        <Text size="1" color="gray" style={{ fontFamily: 'monospace' }}>
          {player.duprId}
        </Text>
      </Flex>
      <Text size="2" weight="medium" style={{ color: 'var(--slate-11)' }}>
        {player.doublesRating ?? 'NR'}
      </Text>
    </Flex>
  );

  // ── Selected state ────────────────────────────────────────────────────────
  if (selected) {
    return (
      <Flex
        align="center"
        justify="between"
        style={{
          border: '1px solid var(--green-7)',
          borderRadius: 8,
          padding: '8px 10px',
          backgroundColor: 'var(--green-2)',
        }}
      >
        <Flex direction="column" gap="1">
          <Text size="2" weight="bold" style={{ color: 'var(--green-11)' }}>
            {selected.fullName}
          </Text>
          <Flex gap="3">
            <Text size="1" color="gray">
              ID: <span style={{ fontFamily: 'monospace' }}>{selected.duprId}</span>
            </Text>
            <Text size="1" color="gray">
              Doubles: {selected.doublesRating ?? 'NR'}
            </Text>
          </Flex>
        </Flex>
        {!disabled && (
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            onClick={handleClear}
            title="Clear player"
          >
            <Cross2Icon />
          </IconButton>
        )}
      </Flex>
    );
  }

  // ── Search / browse state ─────────────────────────────────────────────────
  return (
    <Box ref={containerRef} style={{ position: 'relative' }}>
      {/* Search input — shown in search mode */}
      {mode === 'search' && (
        <Flex
          align="center"
          gap="2"
          style={{
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            padding: '6px 10px',
            backgroundColor: 'white',
          }}
        >
          {searching
            ? <Spinner size="1" />
            : <MagnifyingGlassIcon color="var(--gray-9)" />
          }
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              border: 'none',
              outline: 'none',
              flex: 1,
              fontSize: 14,
              backgroundColor: 'transparent',
              color: 'var(--gray-12)',
            }}
          />
          {query && (
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              onClick={() => { setQuery(''); setResults([]); setOpen(false); }}
            >
              <Cross2Icon />
            </IconButton>
          )}
        </Flex>
      )}

      {/* Browse mode header — tapping switches back to search */}
      {mode === 'browse' && (
        <Flex
          align="center"
          gap="2"
          style={{
            border: '1px solid var(--gray-6)',
            borderRadius: 8,
            padding: '6px 10px',
            backgroundColor: 'var(--gray-2)',
            cursor: 'pointer',
          }}
          onClick={handleBackToSearch}
        >
          <PersonIcon color="var(--gray-9)" />
          <Text size="2" color="gray" style={{ flex: 1 }}>Club members</Text>
          <Text size="1" style={{ color: 'var(--blue-9)', textDecoration: 'underline' }}>
            ← Search by name
          </Text>
        </Flex>
      )}

      {/* Helper text */}
      {mode === 'search' && searchError && (
        <Text size="1" color="red" mt="1">{searchError}</Text>
      )}
      {mode === 'search' && query.length > 0 && query.length < MIN_CHARS && (
        <Text size="1" color="gray" mt="1">
          Type at least {MIN_CHARS} characters to search
        </Text>
      )}

      {/* Browse club members link — only shown when clubId provided */}
      {mode === 'search' && clubId && !disabled && (
        <Flex
          align="center"
          gap="1"
          mt="1"
          style={{ cursor: 'pointer', width: 'fit-content' }}
          onClick={handleBrowseClick}
        >
          <PersonIcon color="var(--blue-9)" width={12} height={12} />
          <Text size="1" style={{ color: 'var(--blue-9)', textDecoration: 'underline' }}>
            Browse club members
          </Text>
        </Flex>
      )}

      {/* Dropdown */}
      {open && (
        <Box
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 50,
            backgroundColor: 'white',
            border: '1px solid var(--gray-5)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            marginTop: 4,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {mode === 'search' && (
            results.length === 0 ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" color="gray">No players found for "{query}"</Text>
              </Box>
            ) : (
              results.map(renderPlayerRow)
            )
          )}

          {mode === 'browse' && (
            membersLoading ? (
              <Flex justify="center" p="4">
                <Spinner size="2" />
              </Flex>
            ) : membersError ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" color="red">{membersError}</Text>
              </Box>
            ) : members.length === 0 ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" color="gray">No members found in this club.</Text>
              </Box>
            ) : (
              members.map(renderPlayerRow)
            )
          )}
        </Box>
      )}
    </Box>
  );
}