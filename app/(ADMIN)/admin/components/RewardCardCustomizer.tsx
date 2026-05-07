'use client';

import { useRef, useState } from 'react';
import { Box, Button, Callout, Flex, Text, Spinner } from '@radix-ui/themes';
import { Gift, Upload } from 'lucide-react';

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

// ── Mini card preview ─────────────────────────────────────────────────────────
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
    <Box
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        width: '100%',
        maxWidth: 320,
        border: '1px solid var(--gray-4)',
      }}
    >
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
            backgroundColor: 'rgba(255,255,255,0.9)',
            padding: 4, borderRadius: 8,
          }}>
            <img src={logo} alt="Logo" style={{ height: 28, width: 28, objectFit: 'contain' }} />
          </Box>
        )}
        <Flex direction="column" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 14px',
        }}>
          <Text size="1" style={{
            color: 'rgba(255,255,255,0.8)', textTransform: 'uppercase',
            letterSpacing: '0.1em', marginBottom: 2, textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}>
            Your Brand
          </Text>
          <Text size="4" weight="bold" style={{
            color: textColor, textShadow: '0 1px 3px rgba(0,0,0,0.8)', lineHeight: 1.1,
          }}>
            Sample Reward Name
          </Text>
        </Flex>
      </Box>
      <Flex direction="column" style={{ padding: '12px 14px', backgroundColor: 'white' }} gap="3">
        <Flex align="center" justify="center" style={{
          backgroundColor: 'var(--lime-9)', borderRadius: 10, padding: '8px 12px', gap: 6,
        }}>
          <Gift size={15} color="var(--slate-12)" />
          <Text size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>Claim Reward</Text>
        </Flex>
      </Flex>
    </Box>
  );
}

// ── File upload button ────────────────────────────────────────────────────────
function ImageUploadButton({
  label, accept, onFile, loading, currentUrl, hint, isLogo = false,
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
    <Flex direction="column" gap="2">
      <Text size="2" weight="medium">{label}</Text>
      <Text size="1" color="gray">{hint}</Text>
      {currentUrl && (
        isLogo ? (
          // Logo: unconstrained width, contain the whole image, no cropping.
          <Box style={{
            maxWidth: 160,
            padding: 8,
            border: '1px solid var(--gray-4)',
            borderRadius: 8,
            backgroundColor: 'var(--gray-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <img
              src={currentUrl}
              alt="Logo preview"
              style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain', display: 'block' }}
            />
          </Box>
        ) : (
          // Background: fixed aspect ratio crop is fine here.
          <Box style={{
            width: 120, height: 64, borderRadius: 8,
            overflow: 'hidden', border: '1px solid var(--gray-4)',
            backgroundImage: `url(${currentUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }} />
        )
      )}
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
        style={{ width: 'fit-content' }}
      >
        {loading ? <Spinner size="1" /> : <Upload size={14} />}
        {loading ? 'Uploading…' : `Upload ${label}`}
      </Button>
    </Flex>
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
  const [previewBg, setPreviewBg] = useState(currentBackgroundImage ?? DEFAULT_BG);
  const [previewLogo, setPreviewLogo] = useState(currentLogo);

  // Text color: local preview state separate from saved state.
  // The admin can experiment without triggering a save.
  const [previewTextColor, setPreviewTextColor] = useState(currentTextColor);
  const [savedTextColor, setSavedTextColor] = useState(currentTextColor);
  const colorHasUnsavedChanges = previewTextColor !== savedTextColor;

  const [bgLoading, setBgLoading] = useState(false);
  const [logoLoading, setLogoLoading] = useState(false);
  const [colorSaving, setColorSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // Images save immediately on upload — the file is already on disk,
  // so there's no benefit to making the admin click save separately.
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

  // Text color requires explicit save so admins can experiment first.
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
    <Flex direction={{ initial: 'column', sm: 'row' }} gap="9" align="start">
      {/* Left: controls */}
      <Flex direction="column" gap="5" mr={{initial: '0', md: '9'}}>
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

        <ImageUploadButton
          label="Card Background"
          accept="image/png, image/jpeg"
          onFile={(file) => uploadImage(file, 'background')}
          loading={bgLoading}
          currentUrl={previewBg !== DEFAULT_BG ? previewBg : undefined}
          hint="PNG or JPG, max 2MB. Displays behind the reward name."
        />

        <ImageUploadButton
          label="Logo"
          accept="image/png, image/jpeg"
          onFile={(file) => uploadImage(file, 'logo')}
          loading={logoLoading}
          currentUrl={previewLogo}
          hint="PNG or JPG, max 500KB. Shown in the top-left of the card."
          isLogo
        />

        {/* Text color picker — preview only until Save is clicked */}
        <Flex direction="column" gap="2">
          <Text size="2" weight="medium">Reward Name Text Color</Text>
          <Text size="1" color="gray">
            Select a color to preview, then click Save to apply.
          </Text>
          <Flex gap="3" align="center">
            {(['#ffffff', '#000000'] as const).map((color) => (
              <Flex
                key={color}
                align="center"
                gap="2"
                style={{ cursor: 'pointer' }}
                onClick={() => setPreviewTextColor(color)}
              >
                <Box style={{
                  width: 28, height: 28, borderRadius: '50%',
                  backgroundColor: color,
                  border: previewTextColor === color
                    ? '3px solid var(--blue-9)'
                    : '2px solid var(--gray-6)',
                  boxShadow: previewTextColor === color
                    ? '0 0 0 2px var(--blue-5)'
                    : 'none',
                  transition: 'all 0.15s',
                }} />
                <Text size="2" color="gray">
                  {color === '#ffffff' ? 'White' : 'Black'}
                </Text>
              </Flex>
            ))}
          </Flex>

          {/* Save button only shown when there's an unsaved color change */}
          {colorHasUnsavedChanges && (
            <Button
              size="2"
              onClick={saveTextColor}
              disabled={colorSaving}
              style={{ width: 'fit-content', marginTop: 4 }}
            >
              {colorSaving ? <Spinner size="1" /> : null}
              {colorSaving ? 'Saving…' : 'Save text color'}
            </Button>
          )}
        </Flex>
      </Flex>

      {/* Right: live preview */}
      <Flex direction="column" gap="3" width={'250px'} style={{ flexShrink: 0 }}>
        <Text size="3" weight="bold" color="gray">Preview</Text>
        <CardPreview
          bgImage={previewBg}
          textColor={previewTextColor}
          logo={previewLogo}
        />
      </Flex>
    </Flex>
  );
}