'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Box, Button, Flex, IconButton, Text, Spinner } from '@radix-ui/themes';
import { Cross2Icon } from '@radix-ui/react-icons';
import { Gift, Upload, CheckCircle2, Move, AlertTriangle } from 'lucide-react';

interface RewardCardCustomizerProps {
  clientId: string;
  currentBackgroundImage?: string;
  currentTextColor?: string;
  currentLogo?: string;
  currentBackgroundPosition?: string;
  onSaved: (updates: {
    cardBackgroundImage?: string;
    cardTextColor?: string;
    logo?: string;
    cardBackgroundPosition?: string;
  }) => void;
}

const DEFAULT_BG = '/rewardCardBackgrounds/defaultCardBackground.jpg';

// Legacy keyword values from the earlier preset-grid version — a client
// who already picked one of these has that string saved, not a
// percentage pair. Converted to the equivalent x/y so dragging can pick
// up from wherever they left off instead of silently resetting.
const LEGACY_KEYWORD_POSITIONS: Record<string, { x: number; y: number }> = {
  'top left': { x: 0, y: 0 },
  'top': { x: 50, y: 0 },
  'top right': { x: 100, y: 0 },
  'left': { x: 0, y: 50 },
  'center': { x: 50, y: 50 },
  'right': { x: 100, y: 50 },
  'bottom left': { x: 0, y: 100 },
  'bottom': { x: 50, y: 100 },
  'bottom right': { x: 100, y: 100 },
};

function parsePosition(pos: string): { x: number; y: number } {
  const percentMatch = pos.match(/^(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (percentMatch) {
    return { x: parseFloat(percentMatch[1]), y: parseFloat(percentMatch[2]) };
  }
  return LEGACY_KEYWORD_POSITIONS[pos] ?? { x: 50, y: 50 };
}

function formatPosition({ x, y }: { x: number; y: number }): string {
  return `${Math.round(x)}% ${Math.round(y)}%`;
}

// ── Card preview — now the drag surface itself ────────────────────────────────

function CardPreview({
  bgImage,
  textColor,
  logo,
  backgroundPosition,
  onPositionChange,
}: {
  bgImage: string;
  textColor: string;
  logo?: string;
  backgroundPosition: string;
  onPositionChange: (position: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ startX: number; startY: number; startPos: { x: number; y: number } } | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPos: parsePosition(backgroundPosition),
    };
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current || !containerRef.current) return;
    const { startX, startY, startPos } = dragStateRef.current;
    const rect = containerRef.current.getBoundingClientRect();

    // Inverted on purpose — dragging right should feel like sliding the
    // photo right (revealing more of its LEFT edge), but CSS
    // background-position % works the other way: a HIGHER x% reveals
    // more of the image's RIGHT side. Confirmed against the CSS spec's
    // own positioning formula before writing this, not just eyeballed.
    const deltaXPercent = ((e.clientX - startX) / rect.width) * 100;
    const deltaYPercent = ((e.clientY - startY) / rect.height) * 100;

    const newX = Math.min(100, Math.max(0, startPos.x - deltaXPercent));
    const newY = Math.min(100, Math.max(0, startPos.y - deltaYPercent));

    onPositionChange(formatPosition({ x: newX, y: newY }));
  };

  const endDrag = () => {
    dragStateRef.current = null;
    setIsDragging(false);
  };

  return (
    <Box style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '0.5px solid var(--gray-4)',
      width: '100%',
    }}>
      <Box
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        style={{
          height: 160,
          position: 'relative',
          overflow: 'hidden',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none', // stops touch-drag from also scrolling the page
          userSelect: 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition,
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
          pointerEvents: 'none',
        }} />
        {logo && (
          <Box style={{ position: 'absolute', top: 10, left: 10, pointerEvents: 'none' }}>
            <img
              src={logo}
              alt="Logo"
              style={{ height: 28, width: 28, objectFit: 'contain' }}
            />
          </Box>
        )}
        <Flex direction="column" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px',
          pointerEvents: 'none',
        }}>
          <Text size="4" weight="bold" style={{
            color: textColor,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            lineHeight: 1.1,
          }}>
            Sample Reward Name
          </Text>
        </Flex>

        {/* Drag affordance — persistent, not just a first-use hint. This
            page gets configured occasionally, not daily, so a hint that
            disappears after one use would just mean a returning admin
            months later doesn't see it either. */}
        <Flex align="center" gap="1" style={{
          position: 'absolute', top: 8, right: 8,
          backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 999,
          padding: '4px 10px', pointerEvents: 'none',
        }}>
          <Move size={12} color="white" />
          <Text size="1" style={{ color: 'white' }}>Drag to reposition</Text>
        </Flex>
      </Box>
      <Flex direction="column" style={{ padding: '12px 14px', backgroundColor: 'white' }} gap="3">
        <Flex align="center" justify="center" style={{
          backgroundColor: 'var(--lime-9)', borderRadius: 10,
          padding: '8px 12px', gap: 6,
        }}>
          <Gift size={15} color="var(--slate-12)" />
          <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>Claim Reward</Text>
        </Flex>
      </Flex>
    </Box>
  );
}

// ── Upload field (unchanged) ────────────────────────────────────────────────

function ImageUploadField({
  label,
  accept,
  onFile,
  loading,
  currentUrl,
  hint,
  isLogo = false,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
  loading: boolean;
  currentUrl?: string;
  hint: string;
  isLogo?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Box style={{
      background: 'var(--gray-1)',
      border: '0.5px solid var(--gray-4)',
      borderRadius: 12,
      padding: '14px 16px',
    }}>
      <Flex align="center" justify="between" mb="2">
        <Text size="2" weight="bold">{label}</Text>
        {currentUrl && (
          <Flex align="center" gap="1" style={{ color: 'var(--green-10)' }}>
            <CheckCircle2 size={13} />
            <Text size="1" style={{ color: 'var(--green-10)' }}>Uploaded</Text>
          </Flex>
        )}
      </Flex>

      {currentUrl && (
        <Box mb="2">
          {isLogo ? (
            <Box style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 8,
              border: '0.5px solid var(--gray-4)',
              borderRadius: 8,
              backgroundColor: 'white',
            }}>
              <img
                src={currentUrl}
                alt="Logo preview"
                style={{ maxHeight: 48, maxWidth: 120, objectFit: 'contain', display: 'block' }}
              />
            </Box>
          ) : (
            <Box style={{
              width: 120, height: 64, borderRadius: 8,
              overflow: 'hidden', border: '0.5px solid var(--gray-4)',
              backgroundImage: `url(${currentUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }} />
          )}
        </Box>
      )}

      <Text size="1" color="gray" style={{ display: 'block', marginBottom: 10 }}>{hint}</Text>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = '';
        }}
      />
      <Button
        variant="soft"
        size="2"
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        style={{ cursor: loading ? 'default' : 'pointer' }}
      >
        {loading ? <Spinner size="1" /> : <Upload size={14} />}
        {loading ? 'Uploading…' : currentUrl ? `Replace ${label}` : `Upload ${label}`}
      </Button>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RewardCardCustomizer({
  clientId,
  currentBackgroundImage,
  currentTextColor = '#ffffff',
  currentLogo,
  currentBackgroundPosition = 'center',
  onSaved,
}: RewardCardCustomizerProps) {

  const [previewBg, setPreviewBg] = useState(currentBackgroundImage ?? DEFAULT_BG);
  const [previewLogo, setPreviewLogo] = useState(currentLogo);
  const [previewTextColor, setPreviewTextColor] = useState(currentTextColor);
  const [savedTextColor, setSavedTextColor] = useState(currentTextColor);
  const colorHasUnsavedChanges = previewTextColor !== savedTextColor;

  const [previewPosition, setPreviewPosition] = useState(currentBackgroundPosition);
  const [savedPosition, setSavedPosition] = useState(currentBackgroundPosition);

  const [bgLoading, setBgLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);
  const [positionSaving, setPositionSaving] = useState(false);

  // Toast feedback — replaces the old inline Callout entirely (not just
  // for position). It was shared across all four sub-features already,
  // and having two different feedback mechanisms in one small component
  // would be worse than fixing it once. Success auto-dismisses; error
  // persists with a manual close, same convention used elsewhere.
  const [toastSuccess, setToastSuccess] = useState<string | null>(null);
  const [toastError, setToastError] = useState<string | null>(null);

  const showToastSuccess = (msg: string) => {
    setToastError(null);
    setToastSuccess(msg);
    setTimeout(() => setToastSuccess(null), 3000);
  };

  // ── uploadImage (logic unchanged, now reports via toast) ──
  const uploadImage = async (file: File, imageType: 'background' | 'logo') => {
    setToastError(null);
    const setter = imageType === 'background' ? setBgLoading : setLogoLoading;
    setter(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('clientId', clientId);
      form.append('imageType', imageType);

      const res = await fetch('/api/upload-image', { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');

      if (imageType === 'background') {
        setPreviewBg(data.url);
        onSaved({ cardBackgroundImage: data.url });
        showToastSuccess('Card background saved.');
      } else {
        setPreviewLogo(data.url);
        onSaved({ logo: data.url });
        showToastSuccess('Logo saved.');
      }
    } catch (e) {
      setToastError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setter(false);
    }
  };

  // ── saveTextColor (logic unchanged, now reports via toast) ──
  const saveTextColor = async () => {
    setToastError(null);
    setColorSaving(true);
    try {
      const res = await fetch('/api/client/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, cardTextColor: previewTextColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save text color');
      setSavedTextColor(previewTextColor);
      onSaved({ cardTextColor: previewTextColor });
      showToastSuccess('Text color saved.');
    } catch (e) {
      setToastError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setColorSaving(false);
    }
  };

  // ── Position: debounced auto-save ──
  // Re-arms on every change (including every pointer-move during an
  // active drag), so it only actually fires once the position has been
  // STABLE for a full 3 seconds — not on every pixel of movement, and not
  // immediately on drag-release either, in case the admin nudges it again
  // right after letting go.
  useEffect(() => {
    if (previewPosition === savedPosition) return;
    const timer = setTimeout(() => {
      savePosition(previewPosition);
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPosition]);

  const savePosition = async (position: string) => {
    setPositionSaving(true);
    setToastError(null);
    try {
      const res = await fetch('/api/client/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, cardBackgroundPosition: position }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to save position');
      setSavedPosition(position);
      onSaved({ cardBackgroundPosition: position });
      showToastSuccess('Image position saved.');
    } catch (e) {
      // Reverts the visible position back to the last saved value — the
      // error message says so explicitly, since a silent snap-back with
      // a generic "try again" wouldn't explain why the image just moved.
      setPreviewPosition(savedPosition);
      setToastError("Error saving. reverted to the last saved position. Please try again.");
    } finally {
      setPositionSaving(false);
    }
  };

  return (
    <Flex direction="column" gap="5">

      <AnimatePresence>
        {(toastSuccess || toastError) && (
          <motion.div
            key="customizer-toast"
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.2 }}
            style={{
              position: 'fixed',
              top: 20,
              left: 0,
              right: 0,
              width: 'fit-content',
              maxWidth: '90vw',
              margin: '0 auto',
              zIndex: 100,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              backgroundColor: toastError ? '#3a1414' : '#111',
              border: toastError ? '1px solid rgba(239,68,68,0.35)' : 'none',
              padding: '10px 14px 10px 20px',
              borderRadius: 999,
              boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            }}
          >
            {toastError ? (
              <AlertTriangle size={16} color="#f87171" style={{ flexShrink: 0 }} />
            ) : (
              <CheckCircle2 size={16} color="#a3e635" style={{ flexShrink: 0 }} />
            )}
            <Text size="2" style={{ color: '#fff' }}>{toastError || toastSuccess}</Text>
            {toastError && (
              <IconButton
                size="1"
                variant="ghost"
                color="gray"
                onClick={() => setToastError(null)}
                style={{ cursor: 'pointer', color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}
              >
                <Cross2Icon width="14" height="14" />
              </IconButton>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-column: controls left, live preview right */}
      <Flex direction={{ initial: 'column', sm: 'row' }} gap="9" align="start">

        {/* Controls */}
        <Flex direction="column" gap="4" style={{ flex: 1, minWidth: 0 }}>

          <ImageUploadField
            label="Card Background"
            accept="image/png, image/jpeg"
            onFile={(file) => uploadImage(file, 'background')}
            loading={bgLoading}
            currentUrl={previewBg !== DEFAULT_BG ? previewBg : undefined}
            hint="PNG or JPG, max 2MB. Displays behind the reward name. Drag the preview on the right to reposition it."
          />

          <ImageUploadField
            label="Logo"
            accept="image/png, image/jpeg"
            onFile={(file) => uploadImage(file, 'logo')}
            loading={logoLoading}
            currentUrl={previewLogo}
            hint="PNG or JPG, max 500KB. Shown in the top-left of the card."
            isLogo
          />

          {/* Text color — preview + explicit save (logic unchanged) */}
          <Box style={{
            background: 'var(--gray-1)',
            border: '0.5px solid var(--gray-4)',
            borderRadius: 12,
            padding: '14px 16px',
          }}>
            <Text size="2" weight="bold" style={{ display: 'block', marginBottom: 8 }}>
              Reward Name Text Color
            </Text>
            <Text size="1" color="gray" style={{ display: 'block', marginBottom: 12 }}>
              Select a color to preview, then click Save to apply.
            </Text>

            <Flex gap="2" mb="3">
              {(['#ffffff', '#000000'] as const).map((color) => {
                const selected = previewTextColor === color;
                return (
                  <Flex
                    key={color}
                    align="center"
                    gap="2"
                    onClick={() => setPreviewTextColor(color)}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: selected
                        ? '1.5px solid var(--blue-8)'
                        : '0.5px solid var(--gray-5)',
                      background: selected ? 'var(--blue-2)' : 'white',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Box style={{
                      width: 20, height: 20, borderRadius: '50%',
                      backgroundColor: color,
                      border: '0.5px solid var(--gray-6)',
                      flexShrink: 0,
                    }} />
                    <Text size="2" style={{
                      color: selected ? 'var(--blue-11)' : 'var(--gray-11)',
                      fontWeight: selected ? 500 : 400,
                    }}>
                      {color === '#ffffff' ? 'White' : 'Black'}
                    </Text>
                    {selected && (
                      <CheckCircle2
                        size={14}
                        style={{ marginLeft: 'auto', color: 'var(--blue-9)' }}
                      />
                    )}
                  </Flex>
                );
              })}
            </Flex>

            {colorHasUnsavedChanges && (
              <Button
                size="2"
                onClick={saveTextColor}
                disabled={colorSaving}
                style={{ cursor: colorSaving ? 'default' : 'pointer' }}
              >
                {colorSaving ? <Spinner size="1" /> : null}
                {colorSaving ? 'Saving…' : 'Save text color'}
              </Button>
            )}
          </Box>
        </Flex>

        {/* Live preview — fixed width, sticky feel */}
        <Box style={{ width: 300, flexShrink: 0 }}>
          <Box style={{
            background: 'var(--gray-2)',
            border: '0.5px solid var(--gray-4)',
            borderRadius: 14,
            padding: 16,
          }}>
            <Flex justify="between" align="center" mb="3">
              <Text
                size="1"
                weight="bold"
                color="gray"
                style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}
              >
                Live preview
              </Text>
              {positionSaving && <Spinner size="1" />}
            </Flex>
            <CardPreview
              bgImage={previewBg}
              textColor={previewTextColor}
              logo={previewLogo}
              backgroundPosition={previewPosition}
              onPositionChange={setPreviewPosition}
            />
          </Box>
        </Box>

      </Flex>
    </Flex>
  );
}