'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ENGINE_VERSION, UnderwritingInputError, buildRentalReport, buildWholesaleDealReport } from '@northstar/underwriting';
import { assertCan, can, fieldErrors, rentalFormSchema, toRentalReportInput, toWholesaleDealInput, wholesaleFormSchema } from '@northstar/core';
import { repo } from '@northstar/db';
import { asTenant } from '../server/session';
import { log } from '../server/db';

export interface SaveResult {
  error?: string;
  fields?: Record<string, string>;
}

/**
 * Persist an analysis. The client sends only the form; the report is ALWAYS recomputed on the server
 * with the same deterministic engine, so a stored report can never diverge from its stored inputs.
 */
export async function saveAnalysisAction(kind: 'wholesale_deal' | 'rental', payload: unknown): Promise<SaveResult> {
  let id: string;
  try {
    const built =
      kind === 'wholesale_deal'
        ? (() => {
            const p = wholesaleFormSchema.safeParse(payload);
            if (!p.success) return { fields: fieldErrors(p.error) } as const;
            const input = toWholesaleDealInput(p.data);
            return { name: p.data.name, form: p.data, input, report: buildWholesaleDealReport(input) } as const;
          })()
        : (() => {
            const p = rentalFormSchema.safeParse(payload);
            if (!p.success) return { fields: fieldErrors(p.error) } as const;
            const input = toRentalReportInput(p.data);
            return { name: p.data.name, form: p.data, input, report: buildRentalReport(input) } as const;
          })();
    if ('fields' in built) return { fields: built.fields, error: 'Some inputs need attention.' };

    id = await asTenant(async (tx, s) => {
      assertCan(s.role, 'underwriting.save');
      const newId = await repo.createAnalysis(tx, {
        name: built.name,
        kind,
        engineVersion: ENGINE_VERSION,
        inputs: { form: built.form, engineInput: built.input },
        report: built.report,
        inputsFingerprint: built.report.inputsFingerprint,
      });
      await repo.recordUsage(tx, { meter: 'underwriting.analysis_saved', quantity: 1, idempotencyKey: `analysis:${newId}` });
      return newId;
    });
  } catch (e) {
    if (e instanceof UnderwritingInputError) return { error: e.message, fields: { [e.field]: e.message } };
    if ((e as Error).name === 'ForbiddenError') return { error: 'Your role can run analyses but not save them.' };
    log.error('underwriting.save_failed', { err: e, ref: randomUUID() });
    return { error: 'The analysis could not be saved. Please try again.' };
  }
  revalidatePath('/app/underwrite');
  redirect(`/app/underwrite/${id}`);
}

export async function setAnalysisStatusAction(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const status = String(form.get('status') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id) || !['final', 'archived', 'draft'].includes(status)) return;
  await asTenant(async (tx, s) => {
    if (!can(s.role, status === 'final' ? 'underwriting.finalize' : 'underwriting.save')) return;
    await repo.setAnalysisStatus(tx, id, status as 'final' | 'archived' | 'draft');
  });
  revalidatePath(`/app/underwrite/${id}`);
}
