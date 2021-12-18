export class finalization_record {
    next: usize;
    cb: u32;
    ptr: usize;
    held: u64;
}

let item: usize = 0;

export function push(ptr: usize, cb: u32, held: u64): void {
    let find = item;

    if (item == 0) {
        item = heap.alloc(offsetof<finalization_record>());
        let ref = changetype<finalization_record>(item);
        ref.cb = cb;
        ref.ptr = ptr;
        ref.next = 0;
        ref.held = held;

        return;
    } else {
        while (true) {
            find = load<usize>(find, offsetof<finalization_record>("ptr"));
            let ref = changetype<finalization_record>(item);
            if (ref.next == 0) {
                let next = ref.next = heap.alloc(offsetof<finalization_record>());
                ref = changetype<finalization_record>(next);
                ref.cb = cb;
                ref.ptr = ptr;
                ref.held = held;
                ref.next = 0;
                return;
            }
        }
    }
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
