import { can } from '@northstar/core';
import { requireSession } from '@/lib/server/session';
import { PageHeader } from '@/components/page-header';
import { WholesaleCalculator } from '@/components/underwrite/wholesale-calculator';
import { RentalCalculator } from '@/components/underwrite/rental-calculator';

export const metadata = { title: 'New analysis' };

export default async function NewAnalysis({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const s = await requireSession();
  const kind = (await searchParams).kind === 'rental' ? 'rental' : 'wholesale';
  const canSave = can(s.role, 'underwriting.save');
  return (
    <>
      <PageHeader
        eyebrow="03 · Northstar Underwrite"
        title={kind === 'rental' ? 'Rental analysis' : 'Wholesale / flip analysis'}
        description={kind === 'rental' ? 'NOI, cap rate, cash-on-cash, DSCR, and multi-year projection. Rates are entered as percentages.' : 'Maximum allowable offer two ways, the end buyer’s economics, and how sensitive the offer is to ARV and repair error.'}
      />
      {kind === 'rental' ? <RentalCalculator canSave={canSave} /> : <WholesaleCalculator canSave={canSave} />}
    </>
  );
}
