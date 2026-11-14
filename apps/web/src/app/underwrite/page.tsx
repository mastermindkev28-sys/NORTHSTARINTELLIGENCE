import { PageHeader } from "@/components/ui";
import { Analyzer } from "./Analyzer";

export default function UnderwritePage() {
  return (
    <>
      <PageHeader eyebrow="Northstar Underwrite" title="Deal analyzer" />
      <p className="-mt-3 mb-6 max-w-3xl text-sm text-muted">Deterministic, tested financial functions. Every output shows its formula and inputs. Estimates support decisions; they are not appraisals or guarantees.</p>
      <Analyzer />
    </>
  );
}
