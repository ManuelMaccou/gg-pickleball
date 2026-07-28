'use client';

import React, { useState } from 'react';
import { Container, Box, Flex, Heading, Text, Badge, Button, Spinner } from '@radix-ui/themes';
import { CheckCircle2, AlertCircle } from 'lucide-react';

type FormState = {
  name: string;
  title: string;
  club: string;
  programName: string;
  programDate: string;
  email: string;
  phone: string;
  authorityConfirmed: boolean;
  disclosureConfirmed: boolean;
};

type FieldErrors = Partial<Record<keyof FormState, string>>;

const initialForm: FormState = {
  name: '',
  title: '',
  club: '',
  programName: '',
  programDate: '',
  email: '',
  phone: '',
  authorityConfirmed: false,
  disclosureConfirmed: false,
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ProgramApplicationPage() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!form.name.trim()) next.name = 'Please enter your name.';
    if (!form.title.trim()) next.title = 'Please enter your title.';
    if (!form.club.trim()) next.club = 'Please enter your club or organization.';
    if (!form.programName.trim()) next.programName = 'Please enter the program name.';
    if (!form.programDate) next.programDate = 'Please select a date.';
    if (!form.email.trim() || !EMAIL_REGEX.test(form.email.trim())) next.email = 'Please enter a valid email address.';
    if (!form.phone.trim()) next.phone = 'Please enter a phone number.';
    if (!form.authorityConfirmed) next.authorityConfirmed = 'This confirmation is required to submit.';
    if (!form.disclosureConfirmed) next.disclosureConfirmed = 'This confirmation is required to submit.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setStatus('submitting');
    setServerError(null);

    try {
      const res = await fetch('/api/programs/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          title: form.title.trim(),
          club: form.club.trim(),
          programName: form.programName.trim(),
          programDate: form.programDate,
          email: form.email.trim(),
          phone: form.phone.trim(),
          authorityConfirmed: form.authorityConfirmed,
          disclosureConfirmed: form.disclosureConfirmed,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setServerError(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
        return;
      }

      setStatus('success');
    } catch {
      setServerError('Something went wrong. Please check your connection and try again.');
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: '#1a1a1a',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: '10px 12px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 6,
    display: 'block',
  };

  const errorStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#f87171',
    marginTop: 4,
    display: 'block',
  };

  if (status === 'success') {
    return (
      <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
        <Container size="2" px="5" py="9">
          <Flex direction="column" align="center" gap="4" style={{ textAlign: 'center', paddingTop: '15vh' }}>
            <Flex align="center" justify="center" style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(163,230,53,0.1)', border: '0.5px solid rgba(163,230,53,0.25)',
              color: '#a3e635',
            }}>
              <CheckCircle2 size={28} strokeWidth={2} />
            </Flex>
            <Heading size="7" style={{ color: '#fff' }}>Got it!</Heading>
            <Text size="3" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 440, lineHeight: 1.6 }}>
              We've received your program details and permission confirmation. Our team will follow
              up at {form.email} to confirm next steps and let you know how to send over your match
              data once the event wraps.
            </Text>
          </Flex>
        </Container>
      </Box>
    );
  }

  return (
    <Box style={{ backgroundColor: '#0a0a0a', minHeight: '100vh' }}>
      {/* Intro */}
      <Container size="2" px="5" pt="9" pb="6">
        <Flex direction="column" align="center" style={{ textAlign: 'center' }}>
          <Badge radius="full" size="1" mb="4" style={{
            background: 'rgba(163,230,53,0.08)', border: '0.5px solid rgba(163,230,53,0.25)',
            color: '#84cc16', fontWeight: 500, letterSpacing: '0.08em', padding: '4px 12px',
          }}>
            For program organizers
          </Badge>
          <Heading size="8" mb="3" style={{ color: '#fff', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
            Bring rewards to your program or tournament
          </Heading>
          <Text size="3" style={{ color: 'rgba(255,255,255,0.6)', maxWidth: 480, lineHeight: 1.6 }}>
            Give us permission to use your match results and we'll turn them into rewards for your
            players. We will contact you regarding next steps.
          </Text>
        </Flex>
      </Container>

      {/* Form */}
      <Container size="1" px="5" pb="9">
        <form onSubmit={handleSubmit} noValidate>
          <Box style={{
            background: '#111', borderRadius: 16, border: '0.5px solid rgba(255,255,255,0.08)',
            padding: 28,
          }}>
            {/* Program details */}
            <Text size="1" weight="bold" mb="3" style={{ display: 'block', color: '#84cc16', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Program details
            </Text>
            <Flex direction="column" gap="4" mb="6">
              <Box>
                <label style={labelStyle} htmlFor="programName">Program name</label>
                <input
                  id="programName"
                  style={inputStyle}
                  value={form.programName}
                  onChange={(e) => setField('programName', e.target.value)}
                  placeholder="e.g. Westside Fall Slam"
                />
                {errors.programName && <span style={errorStyle}>{errors.programName}</span>}
              </Box>
              <Box>
                <label style={labelStyle} htmlFor="programDate">Program date</label>
                <input
                  id="programDate"
                  type="date"
                  className="gg-date-input"
                  style={inputStyle}
                  value={form.programDate}
                  onChange={(e) => setField('programDate', e.target.value)}
                />
                {errors.programDate && <span style={errorStyle}>{errors.programDate}</span>}
              </Box>

              {/* add once anywhere in this component's JSX, or hoist to a shared spot if you use type="date" elsewhere */}
              <style>{`
                .gg-date-input::-webkit-calendar-picker-indicator {
                  filter: invert(1);
                  cursor: pointer;
                }
              `}</style>
            </Flex>

            {/* Your details */}
            <Text size="1" weight="bold" mb="3" style={{ display: 'block', color: '#84cc16', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Your details
            </Text>
            <Flex direction="column" gap="4" mb="6">
              <Flex gap="4" direction={{ initial: 'column', xs: 'row' }}>
                <Box style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="name">Your name</label>
                  <input
                    id="name"
                    style={inputStyle}
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                    placeholder="Jane Smith"
                  />
                  {errors.name && <span style={errorStyle}>{errors.name}</span>}
                </Box>
                <Box style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="title">Your title</label>
                  <input
                    id="title"
                    style={inputStyle}
                    value={form.title}
                    onChange={(e) => setField('title', e.target.value)}
                    placeholder="Program Director"
                  />
                  {errors.title && <span style={errorStyle}>{errors.title}</span>}
                </Box>
              </Flex>
              <Box>
                <label style={labelStyle} htmlFor="club">Club / Organization</label>
                <input
                  id="club"
                  style={inputStyle}
                  value={form.club}
                  onChange={(e) => setField('club', e.target.value)}
                  placeholder="Westside Pickleball Club"
                />
                {errors.club && <span style={errorStyle}>{errors.club}</span>}
              </Box>
              <Flex gap="4" direction={{ initial: 'column', xs: 'row' }}>
                <Box style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="email">Email</label>
                  <input
                    id="email"
                    type="email"
                    style={inputStyle}
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    placeholder="jane@westsidepb.com"
                  />
                  {errors.email && <span style={errorStyle}>{errors.email}</span>}
                </Box>
                <Box style={{ flex: 1 }}>
                  <label style={labelStyle} htmlFor="phone">Phone number</label>
                  <input
                    id="phone"
                    type="tel"
                    style={inputStyle}
                    value={form.phone}
                    onChange={(e) => setField('phone', e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                  {errors.phone && <span style={errorStyle}>{errors.phone}</span>}
                </Box>
              </Flex>
            </Flex>

            {/* Permission */}
            <Text size="1" weight="bold" mb="3" style={{ display: 'block', color: '#84cc16', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Permission
            </Text>
            <Box mb="6">
              <Flex direction="column" gap="4">
                <Box>
                  <Flex gap="3" align="start">
                    <input
                      id="authorityConfirmed"
                      type="checkbox"
                      checked={form.authorityConfirmed}
                      onChange={(e) => setField('authorityConfirmed', e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, accentColor: '#a3e635', flexShrink: 0 }}
                    />
                    <label htmlFor="authorityConfirmed" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, cursor: 'pointer' }}>
                      I confirm that I have the authority to grant this permission on behalf of the program.
                    </label>
                  </Flex>
                  {errors.authorityConfirmed && <span style={errorStyle}>{errors.authorityConfirmed}</span>}
                </Box>

                <Box>
                  <Flex gap="3" align="start">
                    <input
                      id="disclosureConfirmed"
                      type="checkbox"
                      checked={form.disclosureConfirmed}
                      onChange={(e) => setField('disclosureConfirmed', e.target.checked)}
                      style={{ marginTop: 3, width: 16, height: 16, accentColor: '#a3e635', flexShrink: 0 }}
                    />
                    <label htmlFor="disclosureConfirmed" style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5, cursor: 'pointer' }}>
                      I confirm that a disclosure about sharing match and player data with GG Pickleball
                      will be, or already has been, added to this program's registration terms and
                      conditions and/or waiver.
                    </label>
                  </Flex>
                  {errors.disclosureConfirmed && <span style={errorStyle}>{errors.disclosureConfirmed}</span>}
                </Box>
              </Flex>
            </Box>

            {status === 'error' && serverError && (
              <Flex align="center" gap="2" mb="4" style={{
                background: 'rgba(239,68,68,0.08)', border: '0.5px solid rgba(239,68,68,0.25)',
                borderRadius: 8, padding: '10px 12px',
              }}>
                <AlertCircle size={16} color="#f87171" style={{ flexShrink: 0 }} />
                <Text size="2" style={{ color: '#f87171' }}>{serverError}</Text>
              </Flex>
            )}

            <Button type="submit" size="3" radius="full" color="lime" disabled={status === 'submitting'} style={{ width: '100%' }}>
              <Flex align="center" gap="2" justify="center">
                {status === 'submitting' && <Spinner size="1" />}
                {status === 'submitting' ? 'Submitting…' : 'Submit application'}
              </Flex>
            </Button>
          </Box>
        </form>
      </Container>
    </Box>
  );
}