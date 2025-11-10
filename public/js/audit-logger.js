import { db } from './firebase-init.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js';

const AUDIT_LOGS_PATH = 'artifacts/toysfortots-eae4d/private/01/data/01/auditLogs';

/**
 * Log an audit event to Firestore
 * @param {string} action - The action being performed (use AUDIT_ACTIONS constants)
 * @param {object} user - The user object from Firebase Auth (must have uid, email, displayName)
 * @param {object} details - Additional details about the action (targetId, targetType, targetLabel, changes, count, etc.)
 */
export async function logAudit(action, user, details) {
  try {
    const auditRef = collection(db, AUDIT_LOGS_PATH);
    await addDoc(auditRef, {
      action,
      userId: user.uid,
      userEmail: user.email,
      userDisplayName: user.displayName || user.email,
      timestamp: serverTimestamp(),
      details,
      deleted: false
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging failure shouldn't break operations
  }
}

// Pre-defined audit actions for consistency
export const AUDIT_ACTIONS = {
  DELETE_BOX: 'delete_box',
  DELETE_BOX_BULK: 'delete_box_bulk',
  DELETE_REPORT: 'delete_report',
  DELETE_REPORT_BULK: 'delete_report_bulk',
  DELETE_VOLUNTEER: 'delete_volunteer',
  DELETE_VOLUNTEER_BULK: 'delete_volunteer_bulk',
  MODIFY_BOX: 'modify_box',
  MODIFY_VOLUNTEER: 'modify_volunteer',
  MODIFY_VOLUNTEER_ROLE: 'modify_volunteer_role',
  PURGE_SOFT_DELETES: 'purge_soft_deletes',
  PURGE_AUDIT_LOGS: 'purge_audit_logs',
  EXPORT_DATA: 'export_data',
  RESTORE_BOX: 'restore_box',
  RESTORE_REPORT: 'restore_report',
  RESTORE_VOLUNTEER: 'restore_volunteer'
};
