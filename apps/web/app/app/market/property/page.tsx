import { PageHeader } from '@/components/page-header';
import { DemoBanner } from '@/components/ui';
import { MarketTabs } from '@/components/market/parts';
import { UndervaluationWorkbench } from '@/components/market/undervaluation-workbench';

export const metadata = { title: 'Undervaluation evidence' };

export default function PropertyEvidence() {
  return (
    <>
      <PageHeader
        eyebrow="02 · Market Intelligence · property level"
        title="Undervaluation evidence"
        description="Five separate signals, never merged into one label. A property is called potentially below market only when at least three eligible, adjusted comparable sales support it. An AVM or a single comp never does, and assessed value is never treated as market value."
      />
      <MarketTabs active="property" />
      <div className="mb-5"><DemoBanner>Prefilled with an illustrative example. Connect licensed sales data and Discover public-record events to fill this from a property record.</DemoBanner></div>
      <UndervaluationWorkbench />
    </>
  );
}
