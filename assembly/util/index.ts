
export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}

/**
 * An internal finalization record for object disposal.
 */
export class FinalizationRecord {
  constructor(
    public held: u64,
    public cb: u32,
  ) {}
}

/**
 * A map of pointer to FinalizationRecord
 */
let finalizeMap = new Map<usize, FinalizationRecord>();

// @ts-ignore: global decorator
@global export function __lunatic_finalize(ptr: usize): void {
  if (finalizeMap.has(ptr)) {
    let record = finalizeMap.get(ptr);
    call_indirect(record.cb, record.held);
    finalizeMap.delete(ptr);
  }
}

/** Set the finalization record for this reference. */
export function set_finalize(ptr: usize, held: u64, cb: u32): void {
  finalizeMap.set(ptr, new FinalizationRecord(held, cb));
}

/** Check to see if a reference has a finalization record still. */
export function has_finalize(ptr: usize): bool {
  return finalizeMap.has(ptr);
}

export const enum MessageType {
  Data = 0,
  Signal = 1,
  Timeout = 9027,
}

/** Success enum to describe the results of syscalls. The value `0` is successful. */
export const enum err_code {
  Success,
  Fail,
}

export abstract class LunaticManaged {
  constructor(
    held: u64,
    finalize: (val: u64) => void,
  ) {
    set_finalize(changetype<usize>(this), held, finalize.index);
  }

  get dropped(): bool {
    return has_finalize(changetype<usize>(this));
  }

  dispose(): void {
    if (has_finalize(changetype<usize>(this))) {
      __lunatic_finalize(changetype<usize>(this));
    }
  }

  preventFinalize(): void {
    finalizeMap.delete(changetype<usize>(this));
  }
}
