import assert from 'node:assert/strict';
import test from 'node:test';
import { parseExtensionManifestIdentity } from './manifest-identity';

test('keeps semantic release identity separate from Chromium build metadata', () => {
  assert.deepEqual(
    parseExtensionManifestIdentity({ version_name: '0.8.0-beta.42', version: '0.8.42.3' }),
    { releaseVersion: '0.8.0-beta.42', buildVersion: '0.8.42.3' },
  );
});

test('rejects missing, swapped, and malformed identities', () => {
  assert.throws(() => parseExtensionManifestIdentity({ version: '0.8.0.0' }), /version_name/);
  assert.throws(
    () => parseExtensionManifestIdentity({ version_name: '0.8.0.0', version: '0.8.0' }),
    /version_name/,
  );
  assert.throws(
    () => parseExtensionManifestIdentity({ version_name: 'latest', version: '0.8.0.0' }),
    /version_name/,
  );
  assert.throws(
    () => parseExtensionManifestIdentity({ version_name: '0.8.0', version: '0.8.0' }),
    /four-part/,
  );
});
