'use client';

import { useRef, useState } from 'react';
import { Box, Button, Callout, Flex, Text, Spinner } from '@radix-ui/themes';
import { Gift, Upload, CheckCircle2 } from 'lucide-react';

interface RewardCardCustomizerProps {
  clientId: string;
  currentBackgroundImage?: string;
  currentTextColor?: string;
  currentLogo?: string;
  onSaved: (updates: {
    cardBackgroundImage?: string;
    cardTextColor?: string;
    logo?: string;
  }) => void;
}

const DEFAULT_BG = '/rewardCardBackgrounds/defaultCardBackground.jpg';

// ── Card preview (logic unchanged, visual refinements only) ──────────────────

function CardPreview({
  bgImage,
  textColor,
  logo,
}: {
  bgImage: string;
  textColor: string;
  logo?: string;
}) {
  return (
    <Box style={{
      borderRadius: 16,
      overflow: 'hidden',
      border: '0.5px solid var(--gray-4)',
      width: '100%',
    }}>
      <Box style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${bgImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.7) 100%)',
        }} />
        {logo && (
          <Box style={{
            position: 'absolute', top: 10, left: 10,
          }}>
            <img
              src={logo}
              alt="Logo"
              style={{ height: 28, width: 28, objectFit: 'contain' }}
            />
          </Box>
        )}
        <Flex direction="column" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px',
        }}>
          <Text size="4" weight="bold" style={{
            color: textColor,
            textShadow: '0 1px 3px rgba(0,0,0,0.8)',
            lineHeight: 1.1,
          }}>
            Sample Reward Name
          </Text>
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

// ── Upload field ─────────────────────────────────────────────────────────────
// Reading order fixed: label → current thumbnail → hint → button

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

      {/* Thumbnail — shown above hint so context is visual before text */}
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
  onSaved,
}: RewardCardCustomizerProps) {

  // ── State (unchanged) ──
  const [previewBg, setPreviewBg] = useState(currentBackgroundImage ?? DEFAULT_BG);
  const [previewLogo, setPreviewLogo] = useState(currentLogo);
  const [previewTextColor, setPreviewTextColor] = useState(currentTextColor);
  const [savedTextColor, setSavedTextColor] = useState(currentTextColor);
  const colorHasUnsavedChanges = previewTextColor !== savedTextColor;

  const [bgLoading, setBgLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ── showSuccess (unchanged) ──
  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // ── uploadImage (unchanged) ──
  const uploadImage = async (file: File, imageType: 'background' | 'logo') => {
    setError(null);
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
        showSuccess('Card background saved.');
      } else {
        setPreviewLogo(data.url);
        onSaved({ logo: data.url });
        showSuccess('Logo saved.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Please try again.');
    } finally {
      setter(false);
    }
  };

  // ── saveTextColor (unchanged) ──
  const saveTextColor = async () => {
    setError(null);
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
      showSuccess('Text color saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save. Please try again.');
    } finally {
      setColorSaving(false);
    }
  };

  return (
    <Flex direction="column" gap="5">

      {/* Inline feedback — sits at the top, close to everything */}
      {error && (
        <Callout.Root color="red" size="1">
          <Callout.Text>{error}</Callout.Text>
        </Callout.Root>
      )}
      {successMessage && (
        <Callout.Root color="green" size="1">
          <Callout.Text>{successMessage}</Callout.Text>
        </Callout.Root>
      )}

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
            hint="PNG or JPG, max 2MB. Displays behind the reward name."
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

            {/* Color swatches as a segmented row */}
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

            {/* Save button — only shown when there's an unsaved change (logic unchanged) */}
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
            <Text
              size="1"
              weight="bold"
              color="gray"
              style={{
                display: 'block',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
              }}
            >
              Live preview
            </Text>
            <CardPreview
              bgImage={previewBg}
              textColor={previewTextColor}
              logo={previewLogo}
            />
          </Box>
        </Box>

      </Flex>
    </Flex>
  );
}