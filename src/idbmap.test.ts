import { describe, expect, test } from 'vitest';
import { IndexedDBMap } from './idbmap';

import 'fake-indexeddb/auto';

describe('IndexedDBMap', () => {
  test('create', async () => {
    await IndexedDBMap.create<string, string>('test');
  });

  test('insert', async () => {
    const map = await IndexedDBMap.create<string, string>('test2');
    await map.set('foo', 'bar');
    await expect(map.get('foo')).resolves.toBe('bar');
  });

  test('delete', async () => {
    const map = await IndexedDBMap.create<string, string>('test2');
    await map.set('foo', 'bar');
    await map.delete('foo');
    await expect(map.get('foo')).resolves.toBeUndefined();
  });

  test('entries', async () => {
    const map = await IndexedDBMap.create<string, string>('test2');
    await map.set('foo', 'bar');
    await map.set('foo2', 'baz');

    await expect(Array.fromAsync(map.entries())).resolves.toStrictEqual([
      ['foo', 'bar'],
      ['foo2', 'baz'],
    ]);
  });
});
