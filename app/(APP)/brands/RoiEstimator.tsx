'use client';

import React, { useMemo, useState } from 'react';
import { Card, Flex, Grid, Heading, Text, Slider, TextField, Separator, Box, Badge } from '@radix-ui/themes';
import { InfoCircledIcon } from '@radix-ui/react-icons';

// --- LOGIC CONSTANTS ---
const TRADITIONAL_ADS_CPA = 40.00; 
const REPEAT_CUSTOMER_RATE = 0.30; 
const LIFETIME_PURCHASES = 1 + REPEAT_CUSTOMER_RATE; 
const GG_LEAD_CONVERSION_RATE = 0.10; 
const GROSS_MARGIN = 0.35; 

// --- DYNAMIC PRICING LOGIC ---
const getDynamicCpl = (aov: number) => {
  if (aov <= 15) return 0.20; 
  if (aov <= 50) return 0.75; 
  if (aov <= 80) return 1.50; 
  if (aov <= 120) return 2.25; 
  if (aov <= 160) return 3.00; 
  return 3.50; 
};

// --- HELPER COMPONENTS ---

// 1. Result Row Component
const ResultRow = ({ label, value, highlight = false, isNegative = false }: { label: string; value: string; highlight?: boolean; isNegative?: boolean }) => (
  <Flex justify="between" align="center" style={{ marginBottom: '12px' }}>
    <Text size="2" style={{ color: 'var(--slate-11)' }}>{label}</Text>
    <Text 
      size={highlight ? '4' : '3'} 
      weight={highlight ? 'bold' : 'medium'} 
      style={{ 
        color: isNegative ? 'var(--ruby-9)' : highlight ? 'white' : 'var(--slate-12)'
      }}
    >
      {value}
    </Text>
  </Flex>
);

// 2. Result Card Component
const ResultCard = ({ 
  title, 
  results, 
  isWinner = false, 
  accentColor,
  description,
  formatCurrency 
}: { 
  title: string; 
  results: any; 
  isWinner?: boolean; 
  accentColor: 'lime' | 'slate'; 
  description: string;
  formatCurrency: (val: number) => string;
}) => {
  
  const isLime = accentColor === 'lime';
  const roiColor = isLime ? 'var(--lime-9)' : results.roi < 0 ? 'var(--ruby-9)' : 'white';
  const roiBg = isLime ? 'rgba(163, 230, 53, 0.1)' : 'rgba(148, 163, 184, 0.1)';
  const roiBorder = isLime ? '1px solid rgba(163, 230, 53, 0.2)' : '1px solid rgba(148, 163, 184, 0.2)';

  const cardStyle = {
    background: isLime 
      ? 'linear-gradient(145deg, rgba(26, 41, 66, 0.6) 0%, rgba(15, 23, 42, 0.9) 100%)' 
      : 'rgba(30, 41, 59, 0.5)',
    border: isLime ? '1px solid rgba(163, 230, 53, 0.3)' : '1px solid rgba(51, 65, 85, 0.5)',
    borderRadius: '16px',
    boxShadow: isWinner ? '0 0 40px -10px rgba(163, 230, 53, 0.15)' : 'none',
    position: 'relative' as const,
    padding: '24px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px'
  };

  return (
    <div style={cardStyle}>
      {isWinner && (
        <Badge 
          color="lime" 
          variant="solid" 
          radius='large'
          style={{ 
            position: 'absolute', 
            top: '-12px', 
            right: '24px', 
            textTransform: 'uppercase', 
            letterSpacing: '0.05em',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.3)'
          }}
        >
          Recommended
        </Badge>
      )}

      <Box>
        <Heading size="5" style={{ color: isLime ? 'var(--lime-9)' : 'var(--slate-12)', marginBottom: '4px' }}>
          {title}
        </Heading>
        <Text size="1" style={{ color: 'var(--slate-10)' }}>{description}</Text>
      </Box>

      <Box style={{ flexGrow: 1 }}>
        <ResultRow label="Total Ad Spend" value={formatCurrency(results.totalAdSpend)} />
        <ResultRow label="New Customers" value={results.customers.toFixed(0)} />
        <ResultRow label="Ad CPA (Media Cost)" value={formatCurrency(results.cpa)} highlight />
        <ResultRow label="Est. Net Profit" value={formatCurrency(results.netProfit)} highlight isNegative={results.netProfit < 0} />
      </Box>

      <Flex 
        align="center" 
        justify="between" 
        style={{ 
          background: roiBg, 
          border: roiBorder, 
          borderRadius: '12px', 
          padding: '16px' 
        }}
      >
        <Text size="2" weight="bold" style={{ textTransform: 'uppercase', letterSpacing: '0.05em', color: roiColor, opacity: 0.9 }}>
          Projected ROI
        </Text>
        <Heading size="8" style={{ color: roiColor, lineHeight: 1 }}>
          {results.roi.toFixed(0)}%
        </Heading>
      </Flex>
    </div>
  );
};

// --- MAIN COMPONENT ---

const RoiEstimator = () => {
  const [aovStr, setAovStr] = useState('150');
  const [leads, setLeads] = useState(1500);

  const aov = Number(aovStr) || 0;

  const { ggResults, traditionalResults } = useMemo(() => {
    const currentCpl = getDynamicCpl(aov);

    // GG
    const ggTotalAdSpend = leads * currentCpl;
    const ggCustomers = leads * GG_LEAD_CONVERSION_RATE;
    const ggRevenue = ggCustomers * aov * LIFETIME_PURCHASES;
    const ggNetProfit = (ggRevenue * GROSS_MARGIN) - ggTotalAdSpend;
    const ggRoi = ggTotalAdSpend > 0 ? (ggNetProfit / ggTotalAdSpend) * 100 : 0;
    const ggCpa = ggCustomers > 0 ? ggTotalAdSpend / ggCustomers : 0;

    // Traditional (CPA Model)
    const traditionalTotalAdSpend = ggTotalAdSpend; 
    const traditionalCustomers = traditionalTotalAdSpend / TRADITIONAL_ADS_CPA; 
    const traditionalRevenue = traditionalCustomers * aov * LIFETIME_PURCHASES;
    const traditionalNetProfit = (traditionalRevenue * GROSS_MARGIN) - traditionalTotalAdSpend;
    const traditionalRoi = traditionalTotalAdSpend > 0 ? (traditionalNetProfit / traditionalTotalAdSpend) * 100 : 0;

    return { 
      ggResults: { 
        cpl: currentCpl, 
        totalAdSpend: ggTotalAdSpend, 
        customers: ggCustomers, 
        cpa: ggCpa, 
        revenue: ggRevenue, 
        netProfit: ggNetProfit, 
        roi: ggRoi 
      },
      traditionalResults: { 
        totalAdSpend: traditionalTotalAdSpend, // <--- FIXED: Added this line
        customers: traditionalCustomers, 
        cpa: TRADITIONAL_ADS_CPA, 
        revenue: traditionalRevenue, 
        netProfit: traditionalNetProfit, 
        roi: traditionalRoi 
      }
    };
  }, [aov, leads]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
  
  const formatCpl = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(value);

  const handleAovChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // If user deleted everything, set to empty string
    if (val === '') {
      setAovStr('');
      return;
    }
    // Remove leading zeros (e.g., "0100" -> "100")
    // but keep "0" if that's all there is (though a 0 AOV isn't useful, it's valid UI)
    if (val.length > 1 && val.startsWith('0')) {
       setAovStr(val.substring(1));
    } else {
       setAovStr(val);
    }
  };

  return (
    <>
      <style>{`
        .gg-gradient-text {
          background: linear-gradient(to right, var(--lime-9), #4ade80);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          color: transparent;
        }
        .gg-input-container {
          background-color: rgba(30, 41, 59, 0.5); 
          border: 1px solid rgba(51, 65, 85, 0.5);
          border-radius: 16px;
          padding: 24px;
        }
        .vs-badge {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          z-index: 10;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background-color: var(--slate-12);
          border: 4px solid var(--slate-1);
          border-radius: 50%;
          color: var(--slate-9);
          font-weight: bold;
          font-size: 12px;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
        }
        @media (max-width: 768px) {
          .vs-badge { display: none; }
        }
      `}</style>

      <Box style={{ width: '100%', maxWidth: '90%', margin: '0 auto', padding: '16px' }}>
        <div style={{ 
          backgroundColor: '#0f172a',
          borderRadius: '24px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', 
          border: '1px solid #1e293b',
          overflow: 'hidden'
        }}>
          
          <Flex direction="column" align="center" gap="2" p="8" pb="0" style={{ textAlign: 'center' }}>
            <Heading size="8" weight="bold" style={{ color: 'white', letterSpacing: '-0.025em' }}>
              The <span className="gg-gradient-text">GG ROI Engine</span>
            </Heading>
            <Text size="3" style={{ color: 'var(--slate-10)', maxWidth: '600px' }}>
              Compare your potential returns with GG Pickleball against traditional ad platform industry benchmarks.
            </Text>
          </Flex>

          <Box p={{ initial: '4', md: '8' }}>
            
            <Grid columns={{ initial: '1', md: '2' }} gap="6" mb="8" className="gg-input-container">
              <Flex direction="column" gap="3">
                <Box>
                  <Text as="label" size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                    Average Order Value (AOV)
                  </Text>
                  <Text as="div" size="1" style={{ color: 'var(--slate-10)' }}>
                    Your CPL auto-adjusts based on AOV (currently <strong style={{ color: 'var(--lime-9)' }}>{formatCpl(ggResults.cpl)}</strong>).
                  </Text>
                </Box>
                 <TextField.Root 
                  size="3" 
                  value={aovStr} 
                  onChange={handleAovChange} 
                  type="number"
                  variant="surface"
                >
                  <TextField.Slot>$</TextField.Slot>
                </TextField.Root>
              </Flex>

              <Flex direction="column" gap="3">
                <Flex justify="between">
                  <Box>
                    <Text as="label" size="2" weight="bold" style={{ color: 'var(--slate-12)' }}>
                      Qualified Leads
                    </Text>
                    <Text as="div" size="1" style={{ color: 'var(--slate-10)' }}>
                      The number of leads connected to your brand.
                    </Text>
                  </Box>
                  <Text size="3" weight="bold" style={{ color: 'white' }}>{leads.toLocaleString()}</Text>
                </Flex>
                <Slider 
                  value={[leads]} 
                  onValueChange={(v) => setLeads(v[0])} 
                  min={250} 
                  max={10000} 
                  step={50} 
                  color="lime"
                  highContrast
                />
              </Flex>
            </Grid>

            <Box style={{ position: 'relative' }}>
              <div className="vs-badge">VS</div>
              <Grid columns={{ initial: '1', md: '2' }} gap="6">
                
                <ResultCard 
                  title="GG Pickleball"
                  results={ggResults}
                  isWinner={true}
                  accentColor="lime"
                  description={`Results based on verified players & ${formatCpl(ggResults.cpl)} dynamic CPL.`}
                  formatCurrency={formatCurrency}
                />
                
                <ResultCard 
                  title="Traditional Ads"
                  results={traditionalResults}
                  accentColor="slate"
                  description={`Based on industry avg Ad CPA of $${TRADITIONAL_ADS_CPA} (Instagram).`}
                  formatCurrency={formatCurrency}
                />

              </Grid>
            </Box>

            <Box mt="8" pt="6" style={{ borderTop: '1px solid var(--slate-3)' }}>
              <Flex gap="3" align="start">
                <InfoCircledIcon style={{ color: 'var(--slate-10)', marginTop: '2px', flexShrink: 0 }} />
                <Box>
                  <Text size="1" weight="bold" style={{ color: 'var(--slate-11)' }}>Methodology:</Text>
                  <Text size="1" style={{ color: 'var(--slate-10)', display: 'block', marginTop: '4px' }}>
                    Traditional performance is calculated using an <strong>Ad CPA of ${TRADITIONAL_ADS_CPA}</strong>. This is derived from an Instagram CPC of $0.80 (Zapier) and a 2% Conversion Rate (Quimbly).
                  </Text>
                  <Text size="1" style={{ color: 'var(--slate-10)', display: 'block', marginTop: '2px' }}>
                    Calculations assume a {GROSS_MARGIN * 100}% gross margin and a {REPEAT_CUSTOMER_RATE * 100}% repeat customer rate (SmartBug).
                  </Text>
                </Box>
              </Flex>
            </Box>

          </Box>
        </div>
      </Box>
    </>
  );
};

export default RoiEstimator;