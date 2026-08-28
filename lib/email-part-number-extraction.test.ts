import assert from 'node:assert/strict';
import test from 'node:test';
import { extractPartNumberCandidates } from './email-part-number-extraction';

test('extracts every labeled part number from an RFQ email', () => {
  const text = `
Please quote the following Siemens items:

1. Part Number: 6ES7134-6GD01-0BA1
Quantity: 5 pcs

2. Part Number: 6ES7134-6GF00-0AA1
Quantity: 8 pcs

Delivery Location: Dubai, UAE
Phone: 001234567890
`;

  assert.deepEqual(extractPartNumberCandidates(text), [
    { value: '6ES7134-6GD01-0BA1', labeled: true },
    { value: '6ES7134-6GF00-0AA1', labeled: true },
  ]);
});

test('finds compact and separated unlabeled catalog candidates', () => {
  const result = extractPartNumberCandidates(`
A03B-0819-C153    2 pcs
140NOE77111       1 pc
`);

  assert.deepEqual(result, [
    { value: 'A03B-0819-C153', labeled: false },
    { value: '140NOE77111', labeled: false },
  ]);
});

test('allows numeric-only values only when explicitly labeled', () => {
  const result = extractPartNumberCandidates(`
Part No: 0056453
Phone: 001234567890
Required Delivery: 3-5 days
`);

  assert.deepEqual(result, [
    { value: '0056453', labeled: true },
  ]);
});

test('does not repeat a part number from quoted reply history', () => {
  const result = extractPartNumberCandidates(`
Please also quote Part Number: SSA81

-----Original Message-----
Part Number: SSD81
`);

  assert.deepEqual(result, [
    { value: 'SSA81', labeled: true },
  ]);
});
