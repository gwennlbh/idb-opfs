import { type IDBPDatabase, openDB } from 'idb';

/**
 * The name of the database used
 */
export const IDB_DATABASE_NAME = '__idb-opfs__';

/**
 * Implements the Map interface, but methods are asynchronous.
 */
export class IndexedDBMap<K extends string, V> {
  #db: IDBPDatabase;
  #storeName: string;
  reviver: (key: K, value: any) => Promise<V>;
  serializer: (key: K, value: V) => Promise<any>;

  constructor(db: IDBPDatabase, storeName: string) {
    this.#db = db;
    this.#storeName = storeName;
    this.reviver = async (_k, v) => v;
    this.serializer = async (_k, v) => v;
  }

  /**
   *
   * @param objectStoreName name of the object store to use for this map.
   */
  static async create<K extends string, V>(objectStoreName: string, ...init: Array<AsyncIterable<[K, V]>>): Promise<IndexedDBMap<K, V>> {
    const db = await openDB(`${IDB_DATABASE_NAME}:${objectStoreName}`, 1, {
      upgrade(db) {
        db.createObjectStore(objectStoreName, {
          keyPath: 'key',
        });
      },
    });

    db.addEventListener('versionchange', () => db.close());

    const instance = new IndexedDBMap<K, V>(db, objectStoreName);

    for (const iter of init) {
      for await (const [key, value] of iter) {
        await instance.set(key, value);
      }
    }

    return instance;
  }

  async clear(): Promise<void> {
    await this.#db.clear(this.#storeName);
  }

  async delete(key: K): Promise<boolean> {
    if ((await this.get(key)) === undefined) {
      return false;
    }

    await this.#db.delete(this.#storeName, key);

    return true;
  }

  async *entries(): AsyncIterable<[K, V]> {
    const entries = await this.#db.getAll(this.#storeName);

    for (const { key, value } of entries) {
      yield [key, await this.reviver(key, value)];
    }

    // const tx = this.#db.transaction(this.#storeName);

    // TransactionInactiveError, probably due to this.reviver being awaited
    // for await (const cursor of tx.store) {
    //   const { key, value } = cursor.value;
    //   yield [key, await this.reviver(key, value)];
    // }
  }

  async forEach(callback: (value: V, key: K, map: IndexedDBMap<K, V>) => Promise<unknown>): Promise<void> {
    for await (const [key, value] of this.entries()) {
      await callback(value, key, this);
    }
  }

  async get(key: K): Promise<V | undefined> {
    const found = await this.#db.get(this.#storeName, key);
    if (found === undefined) return undefined;
    return this.reviver(key, found.value);
  }

  /**
   * Get the i-th [key, value] entry, in insertion order
   * @param i
   */
  async at(i: number): Promise<[K, V] | undefined> {
    const found = await this.#db.get(this.#storeName, i);

    if (found === undefined) return undefined;

    const { key, value } = found;

    return [key, await this.reviver(key, value)];
  }

  async getOrInsert(key: K, value: V): Promise<V> {
    const existing = await this.get(key);
    if (existing !== undefined) return existing;

    await this.set(key, value);
    return value;
  }

  async getOrInsertComputed(key: K, value: (key: K) => Promise<V>): Promise<V> {
    const existing = await this.get(key);
    if (existing !== undefined) return existing;

    const fallback = await value(key);
    await this.set(key, fallback);
    return fallback;
  }

  async has(key: K): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  async *keys(): AsyncIterable<K> {
    // We can't use openKeyCursor cuz the "key" index is neither the one we want to iterate on (in order to preserve insertion order in iteration), nor the primary index ("i" is the primary index because it can be set to auto-increment)
    for await (const [key] of this.entries()) {
      yield key;
    }
  }

  /**
   * The value can't be `undefined`.
   */
  async set(key: K, value: V): Promise<IndexedDBMap<K, V>> {
    if (value === undefined) throw new Error('Cannot set a value to undefined');

    await this.#db.put(this.#storeName, {
      key,
      value: await this.serializer(key, value),
    });

    return this;
  }

  async *values(): AsyncIterable<V> {
    // AsyncIterator#map doesn't exist bruh
    for await (const [, value] of this.entries()) {
      yield value;
    }
  }
}
