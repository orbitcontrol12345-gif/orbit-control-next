import assert from 'node:assert/strict';
import test from 'node:test';

import {
  isCronApiPath,
  isProductionDiagnosticPath,
  isPublicApiPath,
} from './api-access-control';

test('public endpoints are explicit and admin data stays protected', () => {
  assert.equal(isPublicApiPath('/api/rfq'), true);
  assert.equal(isPublicApiPath('/api/search-products'), true);
  assert.equal(isPublicApiPath('/api/admin/login'), true);
  assert.equal(isPublicApiPath('/api/admin/logout'), false);
  assert.equal(isPublicApiPath('/api/admin/requests'), false);
  assert.equal(isPublicApiPath('/api/catalog/audit'), false);
});

test('cron credentials cannot authorize admin endpoints', () => {
  assert.equal(isCronApiPath('/api/cron/email-part-links'), true);
  assert.equal(isCronApiPath('/api/catalog/sync-r2-images-v6'), true);
  assert.equal(isCronApiPath('/api/migration/match-old-new'), true);
  assert.equal(isCronApiPath('/api/admin/delete-manual-product'), false);
  assert.equal(isCronApiPath('/api/admin/upload-manual-product-image'), false);
  assert.equal(isCronApiPath('/api/r2/test-upload'), false);
});

test('production diagnostics are disabled by default', () => {
  assert.equal(isProductionDiagnosticPath('/api/test-supabase'), true);
  assert.equal(isProductionDiagnosticPath('/api/ebay/diagnostic'), true);
  assert.equal(isProductionDiagnosticPath('/api/ebay/auto-import'), false);
});
