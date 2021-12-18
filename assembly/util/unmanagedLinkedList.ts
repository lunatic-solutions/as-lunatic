export class finalization_record {
    next: usize;
    cb: u32;
    ptr: usize;
    held: u64;
}

let item: usize = 0;

export function push(ptr: usize, cb: u32, held: u64): void {
    let next = heap.alloc(offsetof<finalization_record>());
    let nextRef = changetype<finalization_record>(next);
    nextRef.cb = cb;
    nextRef.held = held;
    nextRef.next = item;
    nextRef.ptr = ptr;
    item = next;
}

export function remove(ptr: usize): finalization_record | null {
    let find: usize = item;
    let prev = 0;
    while (true) {
        if (find == 0) return null;
        let findRef = changetype<finalization_record>(find);
        if (findRef.ptr == ptr) {
            changetype<finalization_record>(prev).next = findRef.next;
            return findRef;
        }
        prev = find;
        find = findRef.next;
    }
}

export function has(ptr: usize): bool {
    let find = item;
    while (true) {
        if (find == 0) return false;
        let findRef = changetype<finalization_record>(find);
        if (findRef.ptr == ptr) return true;
        find = findRef.next;
    }
}
