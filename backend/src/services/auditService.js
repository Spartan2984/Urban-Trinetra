import { AuditLog } from '../models/AuditLog.js';

export const writeAudit = async ({ actor, action, entityType, entityId, metadata = {} }) => {
  return AuditLog.create({ actor, action, entityType, entityId, metadata });
};
