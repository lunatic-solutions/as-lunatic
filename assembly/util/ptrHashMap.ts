import { HASH } from "util/hash";
import { E_KEYNOTFOUND } from "util/error";

// A deterministic hash map based on CloseTable from https://github.com/jorendorff/dht

// @ts-ignore: decorator
@inline const INITIAL_CAPACITY = 4;

// @ts-ignore: decorator
@inline const FILL_FACTOR_N = 8;

// @ts-ignore: decorator
@inline const FILL_FACTOR_D = 3;

// @ts-ignore: decorator
@inline const FREE_FACTOR_N = 3;

// @ts-ignore: decorator
@inline const FREE_FACTOR_D = 4;

/** Structure of a map entry. */
@unmanaged class MapEntry {
  key: usize;
  value: usize;
  taggedNext: usize; // LSB=1 indicates EMPTY
}

/** Empty bit. */
// @ts-ignore: decorator
@inline const EMPTY: usize = 1 << 0;

/** Size of a bucket. */
// @ts-ignore: decorator
@inline const BUCKET_SIZE = sizeof<usize>();

/** Computes the alignment of an entry. */
// @ts-ignore: decorator
@inline
function ENTRY_ALIGN(): usize {
  // can align to 4 instead of 8 if 32-bit and K/V is <= 32-bits
  return sizeof<usize>() - 1;
}

/** Computes the aligned size of an entry. */
// @ts-ignore: decorator
@inline
function ENTRY_SIZE(): usize {
  const align = ENTRY_ALIGN();
  const size = (offsetof<MapEntry>() + align) & ~align;
  return size;
}

// buckets referencing their respective first entry, usize[bucketsMask + 1]
let buckets: usize = heap.alloc(INITIAL_CAPACITY * <i32> BUCKET_SIZE);
let bucketsMask: u32 = INITIAL_CAPACITY - 1;
let entries: usize = heap.alloc(INITIAL_CAPACITY * <i32>ENTRY_SIZE());
let entriesOffset: i32 = 0;
let entriesCount: i32 = 0;
let entriesCapacity = INITIAL_CAPACITY;

export function size(): i32 {
    return entriesCount;
}

export function find(key: usize, hashCode: u32): MapEntry | null {
    var entry = load<MapEntry>( // unmanaged!
        changetype<usize>(buckets) + <usize>(hashCode & bucketsMask) * BUCKET_SIZE
    );
    while (entry) {
        let taggedNext = entry.taggedNext;
        if (!(taggedNext & EMPTY) && entry.key == key) return entry;
        entry = changetype<MapEntry>(taggedNext & ~EMPTY);
    }
    return null;
}

export function has(key: usize): bool {
    return find(key, HASH<usize>(key)) !== null;
}

export function get(key: usize): usize {
    var entry = find(key, HASH<usize>(key));
    if (!entry) throw new Error(E_KEYNOTFOUND); // cannot represent `undefined`
    return entry.value;
}

export function set(key: usize, value: usize): void {
    var hashCode = HASH<usize>(key);
    var entry = find(key, hashCode); // unmanaged!
    if (entry) {
        entry.value = value;

    } else {
        // check if rehashing is necessary
        if (entriesOffset == entriesCapacity) {
            rehash(
                entriesCount < entriesCapacity * FREE_FACTOR_N / FREE_FACTOR_D
                ?  bucketsMask           // just rehash if 1/4+ entries are empty
                : (bucketsMask << 1) | 1 // grow capacity to next 2^N
            );
        }
        // append new entry
        entry = changetype<MapEntry>(entries + <usize>(entriesOffset++) * ENTRY_SIZE());
        // link with the map
        entry.key = key;
        entry.value = value;

        ++entriesCount;
        // link with previous entry in bucket
        let bucketPtrBase = buckets + <usize>(hashCode & bucketsMask) * BUCKET_SIZE;
        entry.taggedNext = load<usize>(bucketPtrBase);
        store<usize>(bucketPtrBase, changetype<usize>(entry));
    }
}

export function del(key: usize): bool {
    var entry = find(key, HASH<usize>(key));
    if (!entry) return false;
    entry.taggedNext |= EMPTY;
    --entriesCount;
    // check if rehashing is appropriate
    var halfBucketsMask = bucketsMask >> 1;
    if (
      halfBucketsMask + 1 >= max<u32>(INITIAL_CAPACITY, entriesCount) &&
      entriesCount < entriesCapacity * FREE_FACTOR_N / FREE_FACTOR_D
    ) rehash(halfBucketsMask);
    return true;
}

export function rehash(newBucketsMask: u32): void {
    var newBucketsCapacity = <i32>(newBucketsMask + 1);
    var newBuckets = heap.alloc(newBucketsCapacity * <i32>BUCKET_SIZE);
    var newEntriesCapacity = newBucketsCapacity * FILL_FACTOR_N / FILL_FACTOR_D;
    var newEntries = heap.alloc(newEntriesCapacity * <i32>ENTRY_SIZE());

    // copy old entries to new entries
    var oldPtr = entries;
    var oldEnd = oldPtr + <usize>entriesOffset * ENTRY_SIZE();
    var newPtr = newEntries;
    while (oldPtr != oldEnd) {
      let oldEntry = changetype<MapEntry>(oldPtr);
      if (!(oldEntry.taggedNext & EMPTY)) {
        let newEntry = changetype<MapEntry>(newPtr);
        let oldEntryKey = oldEntry.key;
        newEntry.key = oldEntryKey;
        newEntry.value = oldEntry.value;
        let newBucketIndex = HASH<usize>(oldEntryKey) & newBucketsMask;
        let newBucketPtrBase = newBuckets + <usize>newBucketIndex * BUCKET_SIZE;
        newEntry.taggedNext = load<usize>(newBucketPtrBase);
        store<usize>(newBucketPtrBase, newPtr);
        newPtr += ENTRY_SIZE();
      }
      oldPtr += ENTRY_SIZE();
    }
    heap.free(buckets);
    buckets = newBuckets;
    bucketsMask = newBucketsMask;
    heap.free(entries);
    entries = newEntries;
    entriesCapacity = newEntriesCapacity;
    entriesOffset = entriesCount;
  }




