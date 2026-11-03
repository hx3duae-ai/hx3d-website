import 'server-only';
import { prisma } from './db';
export const audit = (action: string, o: { actorId?: string; entity?: string; entityId?: string; meta?: object } = {}) =>
  prisma.auditLog.create({ data: { action, actorId: o.actorId, entity: o.entity, entityId: o.entityId, meta: o.meta as never } });
