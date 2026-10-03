import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { parseAlloCallsListResponse } from './allo-response';

describe('parseAlloCallsListResponse', () => {
  it('parses flat results + total_pages', () => {
    const { rawCalls, totalPages } = parseAlloCallsListResponse({
      results: [{ id: '1', from_number: '+331' }],
      total_pages: 4,
    });
    assert.equal(totalPages, 4);
    assert.equal(rawCalls.length, 1);
    assert.equal(rawCalls[0]?.id, '1');
  });

  it('parses single data wrapper with metadata.total_pages', () => {
    const { rawCalls, totalPages } = parseAlloCallsListResponse({
      data: {
        results: [{ id: 'a' }],
        metadata: { total_pages: 2 },
      },
    });
    assert.equal(totalPages, 2);
    assert.equal(rawCalls.length, 1);
    assert.equal(rawCalls[0]?.id, 'a');
  });

  it('parses nested data.data.results (WithAllo live shape)', () => {
    const { rawCalls, totalPages } = parseAlloCallsListResponse({
      data: {
        data: {
          results: [{ id: 'x', from_number: '+336', to_number: '+337' }],
          metadata: { total_pages: 10 },
        },
      },
    });
    assert.equal(totalPages, 10);
    assert.equal(rawCalls.length, 1);
    assert.equal(rawCalls[0]?.from_number, '+336');
  });

  it('accepts calls as alias for results', () => {
    const { rawCalls, totalPages } = parseAlloCallsListResponse({
      data: { calls: [{ id: 'c1' }], metadata: { total_pages: 1 } },
    });
    assert.equal(totalPages, 1);
    assert.equal(rawCalls.length, 1);
    assert.equal(rawCalls[0]?.id, 'c1');
  });

  it('returns empty array for non-object body', () => {
    const { rawCalls, totalPages } = parseAlloCallsListResponse(null);
    assert.equal(totalPages, 1);
    assert.equal(rawCalls.length, 0);
  });
});
