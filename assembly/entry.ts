
import { ASON } from "@ason/assembly";
import {
  proc_exit,
  fd_write,
  iovec,
  random_get
} from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";

import {
  MAX_DOUBLE_LENGTH,
  decimalCount32,
  dtoa_buffered
} from "util/number";
import { IncrementHeldEvent, LinkHeldEvent } from "./managed/held";
import { message } from "./message/bindings";
import { Process } from "./process";
import { ErrCode, opaquePtr } from "./util";


// All of the following wasi implementations for abort, trace and seed are
// copied from:
// https://github.com/AssemblyScript/assemblyscript/blob/master/std/assembly/wasi/index.ts
// Apache License

// TODO: Replace the following functions with the commented import
// when import "wasi" no longer implies --explicitStart

// @ts-ignore: decorator
@global
export function __lunatic_abort(
  message: string | null = null,
  fileName: string | null = null,
  lineNumber: u32 = 0,
  columnNumber: u32 = 0
): void {
  // 0: iov.buf
  // 4: iov.buf_len
  // 8: len
  // 12: buf...
  const iovPtr: usize = 0;
  const lenPtr: usize = iovPtr + offsetof<iovec>();
  const bufPtr: usize = lenPtr + sizeof<usize>();
  const iovec = changetype<iovec>(iovPtr);

  var ptr = iovec.buf = bufPtr;
  store<u64>(ptr, 0x203A74726F6261); ptr += 7; // 'abort: '

  if (message) {
    ptr += String.UTF8.encodeUnsafe(changetype<usize>(message), message.length, ptr);
    store<u32>(ptr, 0x206E6920); ptr += 4; // ' in '
  }

  if (fileName) {
    ptr += String.UTF8.encodeUnsafe(changetype<usize>(fileName), fileName.length, ptr);
  }

  store<u8>(ptr++, 0x28); // (

  var len = decimalCount32(lineNumber); ptr += len;
  do {
    store<u8>(--ptr, 0x30 + lineNumber % 10);
    lineNumber /= 10;
  } while (lineNumber); ptr += len;

  store<u8>(ptr++, 0x3A); // :

  len = decimalCount32(columnNumber); ptr += len;
  do {
    store<u8>(--ptr, 0x30 + columnNumber % 10);
    columnNumber /= 10;
  } while (columnNumber); ptr += len;

  store<u16>(ptr, 0x0A29); ptr += 2; // )\n

  iovec.buf_len = ptr - bufPtr;
  fd_write(2, iovPtr, 1, lenPtr);
  proc_exit(1);
}

function traceAppendNum(bufPtr: usize, a: f64): usize {
  store<u8>(bufPtr++, 0x20); // space
  return 1 + String.UTF8.encodeUnsafe(bufPtr, dtoa_buffered(bufPtr, a), bufPtr);
}

// @ts-ignore: decorator
@global
export function __lunatic_trace( // eslint-disable-line @typescript-eslint/no-unused-vars
  message: string,
  n: i32 = 0,
  a0: f64 = 0,
  a1: f64 = 0,
  a2: f64 = 0,
  a3: f64 = 0,
  a4: f64 = 0
): void {
  // 0: iov.buf
  // 4: iov.buf_len
  // 8: len
  // 12: buf...

  let size: usize
  const iovPtr = __alloc(size =
    offsetof<iovec>() +
    sizeof<usize>() +
    1 + // \n
    7 + // "trace: "
    <usize>(max(String.UTF8.byteLength(message), MAX_DOUBLE_LENGTH << 1)) + // message
    24 * max(0, min(n, 5)) // a{0,1,2,3,4}
  );
  const lenPtr = iovPtr + offsetof<iovec>();
  const bufPtrBase = lenPtr + sizeof<usize>();
  let bufPtr = bufPtrBase;

  store<u64>(bufPtr, 0x203A6563617274); // 'trace: '
  bufPtr += 7;
  bufPtr += String.UTF8.encodeUnsafe(changetype<usize>(message), message.length, bufPtr);

  if (n) {
    bufPtr += traceAppendNum(bufPtr, a0);
    if (n > 1) {
      bufPtr += traceAppendNum(bufPtr, a1);
      if (n > 2) {
        bufPtr += traceAppendNum(bufPtr, a2);
        if (n > 3) {
          bufPtr += traceAppendNum(bufPtr, a3);
          if (n > 4) {
            bufPtr += traceAppendNum(bufPtr, a4);
          }
        }
      }
    }
  }

  store<u8>(bufPtr++, 0x0A); // \n

  const iovec = changetype<iovec>(iovPtr);
  iovec.buf = bufPtrBase;
  iovec.buf_len = bufPtr - bufPtrBase;

  fd_write(2, iovPtr, 1, lenPtr);
  __free(iovPtr);
}

// @ts-ignore
@global
export function __lunatic_seed(): f64 { // eslint-disable-line @typescript-eslint/no-unused-vars
  var temp = load<u64>(0);
  var rand: u64;
  do {
    random_get(0, 8); // to be sure
    rand = load<u64>(0);
  } while (!rand);
  store<u64>(0, temp);
  return reinterpret<f64>(rand);
}

/** Required lunatic export to make processes start. */
export function __lunatic_process_bootstrap(index: u32): void {
  call_indirect(<u32>index, 0);
}

/** Required lunatic export to make processes start. */
export function __lunatic_process_bootstrap_parameter(index: u32, param: u64): void {
  call_indirect(<u32>index, param, 0);
}

export function __heldDecrement(pid: u64): void {
  // this sends an ASON null
  message.create_data(0, sizeof<u64>());
  store<u64>(opaquePtr, 0);
  message.write_data(opaquePtr, sizeof<u64>());
  let result = message.send(pid)
  assert(result == ErrCode.Success);
}
