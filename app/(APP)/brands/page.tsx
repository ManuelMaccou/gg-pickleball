'use client';

import { useState } from 'react';
import { Container, Flex, Box, Heading, Text, Badge, Card, Table, Grid, TextField, Button, Separator } from '@radix-ui/themes';
import { CheckCircledIcon, CrossCircledIcon, ArrowRightIcon } from '@radix-ui/react-icons';
import Link from 'next/link';
import RoiEstimator from './RoiEstimator';
import { MethodologyCard } from './MethodologyCard';

const CustomStyles = () => (
  <style global jsx>{`
    .hero-text-gradient {
      background: linear-gradient(to right, #a3e635, #4ade80);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      color: transparent;
    }
    .fade-in {
      animation: fadeIn 1s ease-out;
    }
    .logo-item {
      opacity: 0.4;
      transition: opacity 0.3s ease;
      letter-spacing: -0.05em;
      text-transform: uppercase;
    }
    .logo-item:hover {
      opacity: 0.8;
      color: var(--lime-9);
      cursor: default;
    }
    .cta-pattern-bg {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      opacity: 0.05;
      background-image: radial-gradient(var(--slate-12) 1px, transparent 1px);
      background-size: 24px 24px;
      pointer-events: none;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .rt-TableRoot {
      background-color: transparent !important;
    }
    .rt-TableRow:last-child {
      border-bottom: none;
    }
  `}</style>
);

export default function BrandsPage() {
  // State for form fields
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    website: '',
    email: ''
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct the email body
    const recipient = "partnerships@ggpickleball.com"; // Replace with your actual email
    const subject = encodeURIComponent(`Demo Request: ${formData.company}`);
    const body = encodeURIComponent(`
Hi Team,

I'm interested in scheduling a demo for GG Pickleball.

My Details:
Name: ${formData.name}
Company: ${formData.company}
Website: ${formData.website}
Work Email: ${formData.email}

Looking forward to hearing from you.
    `);

    // Open mail client
    window.location.href = `mailto:${recipient}?subject=${subject}&body=${body}`;
  };

  return (
    <Box style={{ backgroundColor: '#020617', minHeight: '100vh', color: 'white' }}>
      <CustomStyles />
      
      {/* --- HERO SECTION --- */}
      <Box style={{ 
        background: 'radial-gradient(circle at 50% 0%, #1e293b 0%, #020617 100%)',
        borderBottom: '1px solid #1e293b'
      }} py="9">
        <Container size="3" pt={{ initial: '6', sm: '9' }} pb={{ initial: '7', sm: '9' }}>
          <Flex direction="column" align="center" gap="6" style={{ textAlign: 'center' }}>
            
            <Badge 
              color="lime" 
              variant="surface" 
              size="2" 
              radius="full" 
              className="fade-in"
              style={{ 
                border: '1px solid var(--lime-a5)', 
                color: 'var(--lime-9)',
                padding: '6px 16px'
              }}
            >
              For Modern Brands
            </Badge>

            <Heading as="h1" size="9" weight="bold" style={{ lineHeight: 1.1, letterSpacing: '-0.02em' }}>
              The Most Qualified Lead <br/>
              in <span className="hero-text-gradient">Pickleball.</span>
            </Heading>

            <Text as="p" size="5" style={{ color: 'var(--slate-11)', maxWidth: '40rem', lineHeight: 1.6 }}>
              Connect with verified players at their moment of peak commitment. 
              Stop paying for "impressions" and start paying for performance.
            </Text>

            <Flex gap="4" mt="2">
              <Button asChild size="4" radius="full" color="lime" style={{ fontWeight: 600 }}>
                <Link href="#schedule-demo">Schedule a Demo <ArrowRightIcon /></Link>
              </Button>
              <Button asChild size="4" radius="full" variant="outline" color="gray" style={{ color: 'white' }}>
                <Link href="#roi-calculator">Calculate ROI</Link>
              </Button>
            </Flex>

          </Flex>
        </Container>
      </Box>

      {/* --- COMPARISON SECTION --- */}
      <Box py="9" style={{ backgroundColor: '#020617' }}>
        <Container size="3">
          <Flex direction="column" align="center" gap="4" mb="8" style={{ textAlign: 'center' }}>
            <Heading size="7" weight="bold">Stop Wasting Your Budget</Heading>
            <Text style={{ color: 'var(--slate-11)', maxWidth: '42rem' }} size="4">
              Social media ads are a gamble. We offer a direct connection to athletes who are actively thinking about their gear.
            </Text>
          </Flex>

          <Card size="4" style={{ 
            backgroundColor: 'rgba(30, 41, 59, 0.4)', 
            border: '1px solid var(--slate-6)',
            backdropFilter: 'blur(10px)'
          }}>
            <Table.Root size="3">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell style={{ color: 'var(--slate-11)' }}>METRIC</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    <Text size="3" weight="bold" style={{ color: 'var(--lime-9)' }}>GG Pickleball</Text>
                  </Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>
                    <Text size="3" weight="bold" style={{ color: 'var(--slate-11)' }}>Social Media Ads</Text>
                  </Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>

              <Table.Body>
                <Table.Row>
                  <Table.RowHeaderCell style={{ color: 'white' }}>Audience Quality</Table.RowHeaderCell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CheckCircledIcon color="var(--lime-9)" />
                      <Text style={{ color: 'white' }} weight="bold">Verified Competitors</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CrossCircledIcon color="var(--ruby-9)" />
                     <Text style={{ color: 'var(--slate-10)' }}>Broad / Interest Based</Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.RowHeaderCell style={{ color: 'white' }}>Timing</Table.RowHeaderCell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CheckCircledIcon color="var(--lime-9)" />
                      <Text style={{ color: 'white' }} weight="bold">Post-Match (High Intent)</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CrossCircledIcon color="var(--ruby-9)" />
                     <Text style={{ color: 'var(--slate-10)' }}>Passive Scrolling</Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                 <Table.Row>
                  <Table.RowHeaderCell style={{ color: 'white' }}>Pricing Model</Table.RowHeaderCell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CheckCircledIcon color="var(--lime-9)" />
                      <Text style={{ color: 'white' }} weight="bold">Pay-for-Performance (CPL)</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CrossCircledIcon color="var(--ruby-9)" />
                     <Text style={{ color: 'var(--slate-10)' }}>Pay-for-Impressions (CPM)</Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.RowHeaderCell style={{ color: 'white' }}>Ad Waste</Table.RowHeaderCell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CheckCircledIcon color="var(--lime-9)" />
                      <Text style={{ color: 'white' }} weight="bold">Near Zero</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                     <Flex align="center" gap="2">
                      <CrossCircledIcon color="var(--ruby-9)" />
                      <Text style={{ color: 'var(--slate-10)' }}>High (Bots & Accidental Clicks)</Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>

                <Table.Row>
                  <Table.RowHeaderCell style={{ color: 'white' }}>ROI</Table.RowHeaderCell>
                  <Table.Cell>
                    <Flex align="center" gap="2">
                      <CheckCircledIcon color="var(--lime-9)" />
                      <Text style={{ color: 'white' }} weight="bold">Predictable & Measurable</Text>
                    </Flex>
                  </Table.Cell>
                  <Table.Cell>
                     <Flex align="center" gap="2">
                      <CrossCircledIcon color="var(--ruby-9)" />
                      <Text style={{ color: 'var(--slate-10)' }}>Difficult To Track</Text>
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              </Table.Body>
            </Table.Root>
          </Card>
        </Container>
      </Box>

      {/* --- ROI ENGINE SECTION --- */}
      <Box id="roi-calculator" py="9" style={{ 
        background: 'linear-gradient(180deg, #020617 0%, #0f172a 100%)',
        borderTop: '1px solid var(--slate-4)'
      }}>
        <RoiEstimator />
        <MethodologyCard />
      </Box>

      {/* --- CTA FORM --- */}
      <Box id="schedule-demo" py="9" style={{ backgroundColor: '#1e293b', position: 'relative', overflow: 'hidden' }}>
        <div className="cta-pattern-bg"></div>
        
        <Container size="2" style={{ position: 'relative', zIndex: 1 }}>
          <Flex direction="column" align="center" gap="4" mb="8" style={{ textAlign: 'center' }}>
            <Heading size="8" style={{ color: 'white' }}>Ready to Scale?</Heading>
            <Text style={{ color: 'var(--slate-11)' }} size="4">
              Schedule a demo to see how GG Pickleball can become your most powerful marketing channel.
            </Text>
          </Flex>

          <Card size="4" style={{ backgroundColor: '#0f172a', border: '1px solid var(--slate-6)' }}>
            <form onSubmit={handleEmailSubmit}>
              <Flex direction="column" gap="5">
                
                {/* Row 1: Name & Company */}
                <Grid columns={{ initial: '1', sm: '2' }} gap="5">
                  <Flex direction="column" gap="2">
                    <Text as="label" size="2" weight="bold" htmlFor="name" style={{ color: 'var(--slate-11)' }}>Full Name</Text>
                    <TextField.Root 
                      size="3" 
                      id="name" 
                      placeholder="Jane Doe" 
                      variant="surface" 
                      required
                      value={formData.name}
                      onChange={handleInputChange}
                    />
                  </Flex>
                  <Flex direction="column" gap="2">
                    <Text as="label" size="2" weight="bold" htmlFor="company" style={{ color: 'var(--slate-11)' }}>Company Name</Text>
                    <TextField.Root 
                      size="3" 
                      id="company" 
                      placeholder="Acme Sports" 
                      variant="surface" 
                      required
                      value={formData.company}
                      onChange={handleInputChange}
                    />
                  </Flex>
                </Grid>
                
                {/* Row 2: Website & Email */}
                <Grid columns={{ initial: '1', sm: '2' }} gap="5">
                   <Flex direction="column" gap="2">
                    <Text as="label" size="2" weight="bold" htmlFor="website" style={{ color: 'var(--slate-11)' }}>Company Website</Text>
                    <TextField.Root 
                      size="3" 
                      type='url'
                      id="website" 
                      placeholder="www.acme.com" 
                      variant="surface" 
                      required
                      value={formData.website}
                      onChange={handleInputChange}
                    />
                  </Flex>
                  <Flex direction="column" gap="2">
                    <Text as="label" size="2" weight="bold" htmlFor="email" style={{ color: 'var(--slate-11)' }}>Work Email</Text>
                    <TextField.Root 
                      size="3" 
                      type="email" 
                      id="email" 
                      placeholder="jane@acme.com" 
                      variant="surface" 
                      required
                      value={formData.email}
                      onChange={handleInputChange}
                    />
                  </Flex>
                </Grid>

                <Button size="4" color="lime" style={{ width: '100%', marginTop: '12px', fontWeight: 'bold' }} type="submit">
                  Schedule My Demo
                </Button>
                <Text size="1" align="center" style={{ color: 'var(--slate-10)' }}>
                  This will open your default email client.
                </Text>
              </Flex>
            </form>
          </Card>
        </Container>
      </Box>
    </Box>
  );
}