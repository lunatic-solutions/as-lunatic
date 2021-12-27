import { E_ALLOCATION_TOO_LARGE, E_KEYNOTFOUND } from "util/error";

/** A simple hashtable entry in the resulting flat c-array. */
@unmanaged class ht_entry {
    key: usize;
    held: u64;
    cb: u32;
    free: bool;
}


/** Always points to the currently active table of references. */
let entries: usize = heap.alloc(offsetof<ht_entry>() * LUNATIC_FINALIZATION_ENTRY_COUNT);
/** HashTable capacity. */
let capacity: usize = <usize>LUNATIC_FINALIZATION_ENTRY_COUNT;
/** Current active item count. */
let length: usize = 0;

const FNV_OFFSET: u64 = 14695981039346656037;
const FNV_PRIME: u64 = 1099511628211;

/**
 * Returns a 64-bit FNV-1a hash for a pointer key.
 * https://en.wikipedia.org/wiki/Fowler–Noll–Vo_hash_function
 *
 * @param {usize} ptr - The pointer to be hashed.
 * @returns The pointer hash.
 */
export function hash_key(ptr: usize): u64 {
    let hash: u64 = FNV_OFFSET;
    for (let i: usize = 0; i < sizeof<usize>(); i++) {
        hash ^= <u64>((ptr >>> (i << 3)) & <usize>0xFF);
        hash *= FNV_PRIME;
    }
    return hash;
}

/**
 * Get a finalization entry based on the pointer.
 *
 * @param key - The pointer used by the entry.
 * @returns {ht_entry | null} - The entry or null if it is not found.
 */
export function ht_get(key: usize): ht_entry | null {
    let hash = hash_key(key);
    // size_t index = (size_t)(hash & (uint64_t)(table->capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    // scan the entries
    for (let i: usize = 0; i < capacity; i++) {
        // loop over the entries until we find 0 or key
        let targetIndex = (index + i) % capacity;
        let entry = changetype<ht_entry>(entries + targetIndex * offsetof<ht_entry>());

        // empty space means empty partition.
        if (entry.key == 0) break;

        // if we find the key, the entry must be used
        if (entry.key == key) {
            if (!entry.free) return entry;
            break;
        }
    }

    return null;
}


/**
 * Set a finalization entry.
 *
 * @param {usize} key - The pointer for the entry.
 * @param {u64} held - The held value.
 * @param {u32} cb - The callback index.
 * @returns The entry used.
 */
export function ht_set(key: usize, held: u64, cb: u32): ht_entry {

    if (length >= capacity >>> 1) {
        ht_expand();
    }

    // Set entry and update length.
    return ht_set_entry(key, held, cb);
}

/**
 * Internal set entry method which contains the bulk of the set method.
 *
 * @param {usize} key - The pointer for the entry.
 * @param {u64} held - The held value.
 * @param {u32} cb - The callback index.
 * @returns The entry used.
 */
function ht_set_entry(key: usize, held: u64, cb: u32): ht_entry {
     // AND hash with capacity-1 to ensure it's within entries array.
    let hash = hash_key(key);
     // size_t index = (size_t)(hash & (uint64_t)(capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    // scan the entries
    for (let i: usize = 0; i < capacity; i++) {
        // loop over the entries until we find 0 or key
        let targetIndex = (index + i) % capacity;
        let entry = changetype<ht_entry>(entries + targetIndex * offsetof<ht_entry>());

        // we can use the space if the key is already set, the entry is free, or it's empty space
        if (entry.key == 0 || entry.key == key || entry.free) {
            entry.key = key;
            entry.held = held;
            entry.cb = cb;
            entry.free = false;

            // we are adding an entry to the table
            length++;

            // return the entry
            return entry;
        }
    }
    // This should never be possible, only useful for the compiler
    throw new Error(E_KEYNOTFOUND);
}

/**
 * Remove an entry from the table. The algorithm will scan until it finds an entry that matches
 * the key and is currently used, or it hits a 0, which means the entry does not exist in the table.
 *
 * @param {usize} key - The pointer.
 * @returns The table entry. The entry must be manually zeroed afterwards, but not freed.
 */
export function ht_del(key: usize): ht_entry | null {
    let hash = hash_key(key);
    // size_t index = (size_t)(hash & (uint64_t)(capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    // loop until we find the appropriate entry, or we hit 0
    for (let i: usize = 0; i < capacity; i++) {
        let targetIndex = (index + i) % capacity;
        let entry = changetype<ht_entry>(entries + targetIndex * offsetof<ht_entry>());

        // if there is no pointer here, it's unused space.
        if (entry.key == 0) break;
        // if the record is found, we can return it if it not freed
        if (entry.key == key) {
            // freed entries cannot be returned
            if (entry.free) break;

            // free the entry and return it
            entry.free = true;
            length--;
            return entry;
        }
    }

    return null;
}

/** Realocate more table size. This function may *never* be called mid finalization. */
export function ht_expand(): void {
    // increase the capacity
    let newCapacity = capacity << 1;
    let oldCapacity = capacity;
    if (newCapacity < capacity) assert(false, "Cannot allocate more finalization resources.");

    // allocate a new table
    let newTableByteLength = offsetof<ht_entry>() * newCapacity;
    let newTable = heap.alloc(newTableByteLength);
    let oldTable = entries;
    // assert the values are 0
    memory.fill(newTable, 0, newTableByteLength);

    // in order to move the entries to the new table, we need to set the entries pointer
    entries = newTable;
    length = 0; // length starts at 0
    capacity = newCapacity; // capacity needs to remain accurate

    for (let i: usize = 0; i < oldCapacity; i++) {
        // for each non-null entry
        let entry = changetype<ht_entry>(oldTable + i * offsetof<ht_entry>());
        if (entry.key == 0 || entry.free) continue;

        // set it on the new table
        ht_set_entry(entry.key, entry.held, entry.cb);
    }

    // the table was previously resized
    heap.free(oldTable);
}
