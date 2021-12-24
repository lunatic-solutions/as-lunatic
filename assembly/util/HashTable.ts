import { E_ALLOCATION_TOO_LARGE } from "util/error";

@unmanaged class ht_entry {
    key: usize;
    held: u64;
    cb: u32;
}


const entries: usize = memory.data(offsetof<ht_entry>() * LUNATIC_FINALIZATION_ENTRY_COUNT);  // hash slots
let capacity: usize = <usize>LUNATIC_FINALIZATION_ENTRY_COUNT;    // size of _entries array
let length: usize = 0;      // number of items in hash table

const FNV_OFFSET: u64 = 14695981039346656037;
const FNV_PRIME: u64 = 1099511628211;

// Return 64-bit FNV-1a hash for key (NUL-terminated). See description:
// https://en.wikipedia.org/wiki/Fowler–Noll–Vo_hash_function
export function hash_key(ptr: usize): u64 {
    let hash: u64 = FNV_OFFSET;
    for (let i: usize = 0; i < sizeof<usize>(); i++) {
        hash ^= <u64>((ptr >>> (i << 3)) & <usize>0xFF);
        hash *= FNV_PRIME;
    }
    return hash;
}

export function ht_get(key: usize): ht_entry | null {
    let hash = hash_key(key);
    // size_t index = (size_t)(hash & (uint64_t)(table->capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    // get the first entry
    let entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>());
    // Loop till we find an empty entry.
    while (entry.key != 0) {
        // Found key, return value.
        if (entry.key == key) return entry;

        // Key wasn't in this slot, move to next (linear probing).
        index++;
        if (index >= capacity) {
            // At end of entries array, wrap around.
            index = 0;
        }
        entry = changetype<ht_entry>(entries + ++index * offsetof<ht_entry>());
    }
    return null;
}

let warned: bool = false;
export function ht_set(key: usize, held: u64, cb: u32): ht_entry {
    // If length will exceed half of current capacity, warn user
    if (!warned && length >= capacity * 3 / 4 ) {
        trace("Warning: Using too many finalization record entries. Please allocate more by setting LUNATIC_FINALIZATION_ENTRY_COUNT to a larger number at compile time.");
        warned = false;
    }

    if (length >= capacity) throw new Error(E_ALLOCATION_TOO_LARGE);

    // Set entry and update length.
    return ht_set_entry(key, held, cb);
}

function ht_set_entry(key: usize, held: u64, cb: u32): ht_entry {
     // AND hash with capacity-1 to ensure it's within entries array.
    let hash = hash_key(key);
     // size_t index = (size_t)(hash & (uint64_t)(capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    let entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>());
     // Loop till we find an empty entry.
    while (entry.key != 0) {
        if (entry.key == key) {
             // Found key (it already exists), update value.
            entry.held = held;
            entry.cb = cb;
            return entry;
        }
         // Key wasn't in this slot, move to next (linear probing).
        index++;
        if (index >= capacity) {
             // At end of entries array, wrap around.
            index = 0;
        }
         entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>())
    }
    length++;
    entry.key = key;
    entry.held = held;
    entry.cb = cb;
    return entry;
}

export function ht_del(key: usize): ht_entry | null {
    let hash = hash_key(key);
    // size_t index = (size_t)(hash & (uint64_t)(capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    let entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>());
    while (entry.key != 0) {
        if (entry.key == key) {
            entry.key = 0;
            length--;
            return entry;
        }

        index++;
        if (index >= length) {
            index = 0;
        }
        entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>())
    }
    return null;
}
