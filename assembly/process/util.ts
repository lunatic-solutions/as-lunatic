
//%  - 0x7F => i32
//%  - 0x7E => i64
//%  - 0x7B => v128
/** Predefined location to store tags for function parameters. */
// @ts-ignore: lazy decorator
@lazy const params = memory.data(51); // ( 16(v128) + 1(type) ) * 3(count)
// @ts-ignore: lazy decorator
@lazy let paramCount = 0;
// @ts-ignore: lazy decorator
@lazy let paramOffset = 0;

/** Unmanaged Tag class used for tagging parameters for remote function calls when starting a process. */
@unmanaged export class Parameters {
  static reset(): Parameters {
    paramCount = 0;
    paramOffset = 0;
    // Yes. This is a fake null reference
    return changetype<Parameters>(params);
  }

  /** Tag an i32 parameter. */
  i32(val: i32): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7F);
    store<i32>(params + paramOffset, val, 1);
    paramOffset += 17;
    return this;
  }

  /** Tag an i64 parameter. */
  i64(val: i64): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7E);
    store<i64>(params + paramOffset, val, 1);
    paramOffset += 17;
    return this;
  }

  /** Tag a v128 parameter. */
  v128(val: v128): Parameters {
    assert(paramCount < 3);
    paramCount++;
    store<u8>(params + paramOffset, <u8>0x7B);
    v128.store(params + paramOffset, val, 1);
    paramOffset += 17; // 16(v128) + 1
    return this;
  }

  get ptr(): usize {
    return params;
  }

  get byteLength(): usize {
    return paramCount * 17;
  }
}

export class StartWrapper<TStart> {
  constructor(
    public start: TStart,
    public index: usize,
  ) {}
}