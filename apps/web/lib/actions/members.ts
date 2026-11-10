'use server';

import { revalidatePath } from 'next/cache';
import { can, isRole } from '@northstar/core';
import { repo } from '@northstar/db';
import { asTenant } from '../server/session';

export async function updateRoleAction(form: FormData): Promise<void> {
  const userId = String(form.get('userId') ?? '');
  const role = form.get('role');
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !isRole(role)) return;
  await asTenant(async (tx, s) => {
    if (!can(s.role, 'members.manage')) return;
    if (role === 'owner' && !can(s.role, 'members.grant_owner')) return;
    await repo.updateMemberRole(tx, userId, role);
  });
  revalidatePath('/app/settings/members');
}
