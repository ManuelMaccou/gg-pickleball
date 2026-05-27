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
  clubId?: string;
  placeholder?: string;
  disabled?: boolean;
  // New: switches all internal colors to dark palette
  darkMode?: boolean;
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
  darkMode = false,
}: DuprPlayerSearchProps) {
  // ── State (unchanged) ──
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DuprPlayerResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [mode, setMode] = useState<Mode>('search');
  const [members, setMembers] = useState<DuprPlayerResult[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [membersFetched, setMembersFetched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Click-outside (unchanged) ──
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Debounced search (unchanged) ──
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
        const res = await fetch(`/api/dupr/search-users?query=${encodeURIComponent(query)}`);
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

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, mode]);

  // ── handleBrowseClick (unchanged) ──
  const handleBrowseClick = async () => {
    setMode('browse');
    setOpen(true);
    if (membersFetched) return;
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

  // ── Other handlers (unchanged) ──
  const handleBackToSearch = () => { setMode('search'); setOpen(false); };
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

  // ── Dark/light color tokens ────────────────────────────────────────────────
  const c = darkMode ? {
    inputBg:        '#383838',
    inputBorder:    'rgba(255,255,255,0.15)',
    inputText:      '#ffffff',
    inputPlaceholder: 'rgba(255,255,255,0.35)',
    dropdownBg:     '#2a2a2a',
    dropdownBorder: 'rgba(255,255,255,0.1)',
    rowHover:       'rgba(255,255,255,0.06)',
    rowBorder:      'rgba(255,255,255,0.07)',
    nameText:       '#ffffff',
    idText:         'rgba(255,255,255,0.45)',
    ratingText:     'rgba(255,255,255,0.6)',
    selectedBg:     'rgba(132,204,22,0.12)',
    selectedBorder: 'rgba(132,204,22,0.3)',
    selectedName:   '#a3e635',
    selectedMeta:   'rgba(255,255,255,0.45)',
    browseHeaderBg: 'rgba(255,255,255,0.06)',
    browseLink:     '#a3e635',
    iconColor:      'rgba(255,255,255,0.4)',
    helperText:     'rgba(255,255,255,0.35)',
    emptyText:      'rgba(255,255,255,0.35)',
  } : {
    inputBg:        'white',
    inputBorder:    'var(--gray-6)',
    inputText:      'var(--gray-12)',
    inputPlaceholder: 'var(--gray-9)',
    dropdownBg:     'white',
    dropdownBorder: 'var(--gray-5)',
    rowHover:       'var(--gray-2)',
    rowBorder:      'var(--gray-3)',
    nameText:       'var(--gray-12)',
    idText:         'var(--gray-9)',
    ratingText:     'var(--slate-11)',
    selectedBg:     'var(--green-2)',
    selectedBorder: 'var(--green-7)',
    selectedName:   'var(--green-11)',
    selectedMeta:   'var(--gray-9)',
    browseHeaderBg: 'var(--gray-2)',
    browseLink:     'var(--blue-9)',
    iconColor:      'var(--gray-9)',
    helperText:     'var(--gray-9)',
    emptyText:      'var(--gray-9)',
  };

  // ── renderPlayerRow ────────────────────────────────────────────────────────
  const renderPlayerRow = (player: DuprPlayerResult) => (
    <Flex
      key={player.duprId}
      align="center"
      justify="between"
      onClick={() => handleSelect(player)}
      style={{
        padding: '10px 12px',
        cursor: 'pointer',
        borderBottom: `1px solid ${c.rowBorder}`,
        transition: 'background 0.1s',
        backgroundColor: c.dropdownBg,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = c.rowHover)}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = c.dropdownBg)}
    >
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium" style={{ color: c.nameText }}>{player.fullName}</Text>
        <Text size="1" style={{ color: c.idText, fontFamily: 'monospace' }}>
          {player.duprId}
        </Text>
      </Flex>
      <Text size="2" weight="medium" style={{ color: c.ratingText }}>
        {player.doublesRating ?? 'NR'}
      </Text>
    </Flex>
  );

  // ── Selected state ─────────────────────────────────────────────────────────
  if (selected) {
    return (
      <Flex
        align="center"
        justify="between"
        style={{
          border: `1px solid ${c.selectedBorder}`,
          borderRadius: 8,
          padding: '8px 10px',
          backgroundColor: c.selectedBg,
        }}
      >
        <Flex direction="column" gap="1">
          <Text size="2" weight="bold" style={{ color: c.selectedName }}>
            {selected.fullName}
          </Text>
          <Flex gap="3">
            <Text size="1" style={{ color: c.selectedMeta }}>
              ID: <span style={{ fontFamily: 'monospace' }}>{selected.duprId}</span>
            </Text>
            <Text size="1" style={{ color: c.selectedMeta }}>
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

  // ── Search / browse state ──────────────────────────────────────────────────
  return (
    <Box ref={containerRef} style={{ position: 'relative' }}>

      {/* Search input */}
      {mode === 'search' && (
        <Flex
          align="center"
          gap="2"
          style={{
            border: `1px solid ${c.inputBorder}`,
            borderRadius: 8,
            padding: '6px 10px',
            backgroundColor: c.inputBg,
          }}
        >
          {searching
            ? <Spinner size="1" />
            : <MagnifyingGlassIcon color={c.iconColor} />}
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
              color: c.inputText,
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

      {/* Browse mode header */}
      {mode === 'browse' && (
        <Flex
          align="center"
          gap="2"
          style={{
            border: `1px solid ${c.inputBorder}`,
            borderRadius: 8,
            padding: '6px 10px',
            backgroundColor: c.browseHeaderBg,
            cursor: 'pointer',
          }}
          onClick={handleBackToSearch}
        >
          <PersonIcon color={c.iconColor} />
          <Text size="2" style={{ flex: 1, color: c.helperText }}>Club members</Text>
          <Text size="1" style={{ color: c.browseLink, textDecoration: 'underline' }}>
            ← Search by name
          </Text>
        </Flex>
      )}

      {/* Helper text */}
      {mode === 'search' && searchError && (
        <Text size="1" color="red" mt="1">{searchError}</Text>
      )}
      {mode === 'search' && query.length > 0 && query.length < MIN_CHARS && (
        <Text size="1" mt="1" style={{ color: c.helperText }}>
          Type at least {MIN_CHARS} characters to search
        </Text>
      )}

      {/* Browse club members link */}
      {mode === 'search' && clubId && !disabled && (
        <Flex
          align="center"
          gap="1"
          mt="1"
          style={{ cursor: 'pointer', width: 'fit-content' }}
          onClick={handleBrowseClick}
        >
          <PersonIcon color={c.browseLink} width={12} height={12} />
          <Text size="1" style={{ color: c.browseLink, textDecoration: 'underline' }}>
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
            backgroundColor: c.dropdownBg,
            border: `1px solid ${c.dropdownBorder}`,
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
            marginTop: 4,
            overflow: 'hidden',
            maxHeight: 280,
            overflowY: 'auto',
          }}
        >
          {mode === 'search' && (
            results.length === 0 ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" style={{ color: c.emptyText }}>No players found for "{query}"</Text>
              </Box>
            ) : (
              results.map(renderPlayerRow)
            )
          )}

          {mode === 'browse' && (
            membersLoading ? (
              <Flex justify="center" p="4"><Spinner size="2" /></Flex>
            ) : membersError ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" color="red">{membersError}</Text>
              </Box>
            ) : members.length === 0 ? (
              <Box style={{ padding: '10px 12px' }}>
                <Text size="2" style={{ color: c.emptyText }}>No members found in this club.</Text>
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