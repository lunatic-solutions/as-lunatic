
let finalizeMap = new Map<usize, u32>();

// @ts-ignore: global decorator
@global export function __lunatic_finalize(ptr: usize): void {
  if (finalizeMap.has(ptr)) {
    call_indirect(finalizeMap.get(ptr), ptr);
    finalizeMap.delete(ptr);
  }
}

export function add_finalize<T>(obj: T): void {
  // TODO: Check this
  if (!isReference(obj) || isFunction(obj)) ERROR("Cannot finalize.");

  // @ts-ignore: isDefined is a compile time check
  if (isDefined(obj.dispose())) {
    // @ts-ignore 
    let index: u32 = obj.dispose.index;
    finalizeMap.set(changetype<usize>(obj), index);
  }
}

export abstract class LunaticManaged {
  dropped: bool = false;
  constructor() {}

  abstract dispose(): void;
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
