@unmanaged class ht_entry {
    key: usize;
    value: usize;
}

const INITIAL_ENTRY_COUNT = 16;
let entries: usize = memory.data(offsetof<ht_entry>() * INITIAL_ENTRY_COUNT);  // hash slots
let capacity: usize = <usize>INITIAL_ENTRY_COUNT;    // size of _entries array
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

export function ht_get(key: usize): usize {
    trace("getting", 1, <f64>key);
    let hash = hash_key(key);
    // size_t index = (size_t)(hash & (uint64_t)(table->capacity - 1));
    let index: usize = <usize>(hash & <u64>(capacity - 1));

    // get the first entry
    let entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>());
    // Loop till we find an empty entry.
    while (entry.key != 0) {
        // Found key, return value.
        if (entry.key == key) return entry.value;

        // Key wasn't in this slot, move to next (linear probing).
        index++;
        if (index >= capacity) {
            // At end of entries array, wrap around.
            index = 0;
        }
        entry = changetype<ht_entry>(entries + ++index * offsetof<ht_entry>());
    }
    return 0;
}

export function ht_set(key: usize, value: usize): usize {
    trace("set", 2, <f64>key, <f64>value);

    trace("length, capacity", 2, <f64>length, <f64>capacity);
    // If length will exceed half of current capacity, expand it.
    if (length >= (capacity >> 1)) {
        if (!ht_expand()) {
            return 0;
        }
    }

    // Set entry and update length.
    return ht_set_entry(key, value);
}

function ht_set_entry(key: usize, value: usize): usize {
    trace("setting entry", 2, <f64>key, <f64>value);
     // AND hash with capacity-1 to ensure it's within entries array.
     let hash = hash_key(key);
     // size_t index = (size_t)(hash & (uint64_t)(capacity - 1));
     let index: usize = <usize>(hash & <u64>(capacity - 1));

     let entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>());
     // Loop till we find an empty entry.
     while (entry.key != 0) {
         if (entry.key == 0) {
             // Found key (it already exists), update value.
             entry.value = value;
             return entry.key;
         }
         // Key wasn't in this slot, move to next (linear probing).
         index++;
         if (index >= capacity) {
             // At end of entries array, wrap around.
             index = 0;
         }
         entry = changetype<ht_entry>(entries + index * offsetof<ht_entry>())
     }
     entry.key = key;
     entry.value = value;
     return key;
}

// Expand hash table to twice its current size. Return true on success,
// false if out of memory.
function ht_expand(): bool {
    trace("expanding");
    // Allocate new entries array.
    let new_capacity = capacity << 1;
    if (new_capacity < capacity) {
        return false;  // overflow (capacity would be too big)
    }
    // we are copying old entries to new ones
    let old_entries = entries;
    entries = heap.alloc(new_capacity * sizeof<ht_entry>());

    // Iterate entries, move all non-empty ones to new table's entries.
    for (let i: usize = 0; i < <usize>capacity; i++) {
        let entry = changetype<ht_entry>(old_entries + i * offsetof<ht_entry>());
        if (entry.key != 0) {
            ht_set_entry(entry.key, entry.value);
        }
    }

    // we need to free old entries
    if (old_entries >= __heap_base) heap.free(old_entries);
    // Free old entries array and update this table's details.
    capacity = new_capacity;
    return true;
}
