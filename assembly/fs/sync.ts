import {
  oflags,
  rights,
  lookupflags,
  iovec,
} from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";
import { UnmanagedResult } from "../error";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { readDirUnsafe, readFileUnsafe, writeFileUnsafe } from "./unsafe";
import { Dirent, parseOFlags, parseRights } from "./util";

/** Write a file to the filesystem. Encoding can be either "utf8" or "utf16le" */
export function writeFile<T>(path: string, contents: T, encoding: string = "utf8"): UnmanagedResult<usize> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  let fdrights: rights = rights.FD_WRITE;
  let fdoflags: oflags = oflags.CREAT | oflags.TRUNC;

  if (contents instanceof String) {
    if (encoding == "utf8" || encoding == "utf-8") {
      let bytes = String.UTF8.encode(<string>contents);
      return writeFileUnsafe(
        changetype<usize>(pathPtr),
        pathLen,
        changetype<usize>(bytes),
        <usize>bytes.byteLength,
        lookupflags.SYMLINK_FOLLOW,
        fdrights,
        fdoflags,
      );
    } else if (encoding == "utf16le") {
      return writeFileUnsafe(
        changetype<usize>(pathPtr),
        pathLen,
        changetype<usize>(contents),
        <usize>changetype<OBJECT>(changetype<usize>(contents) - TOTAL_OVERHEAD).rtSize,
        lookupflags.SYMLINK_FOLLOW,
        fdrights,
        fdoflags,
      );
    } else return new UnmanagedResult<usize>(0, "Invalid encoding: " + encoding);
  } else if (contents instanceof ArrayBuffer) {
    return writeFileUnsafe(
      changetype<usize>(pathPtr),
      pathLen,
      changetype<usize>(contents),
      <usize>contents.byteLength,
      lookupflags.SYMLINK_FOLLOW,
      fdrights,
      fdoflags,
    );
    // @ts-ignore: ArrayBufferView is defined
  } else if (contents instanceof ArrayBufferView) {
    // @ts-ignore: ArrayBufferView is defined
    let dataStart: usize = contents.dataStart;
    // @ts-ignore: ArrayBufferView is defined
    let byteLength: usize = <usize>contents.byteLength;
    return writeFileUnsafe(
      changetype<usize>(pathPtr),
      pathLen,
      dataStart,
      byteLength,
      lookupflags.SYMLINK_FOLLOW,
      fdrights,
      fdoflags,
    );
  } else if (contents instanceof Array) {
    if (isReference<valueof<T>>()) ERROR("Cannot call write if type of valueof<T> is a reference.");
    // @ts-ignore: T is a StaticArray<U> and valueof<T> returns U
    let byteLength = (<usize>contents.length) << (alignof<valueof<T>>());
    return writeFileUnsafe(
      changetype<usize>(pathPtr),
      pathLen,
      contents.dataStart,
      byteLength,
      lookupflags.SYMLINK_FOLLOW,
      fdrights,
      fdoflags,
    );
  } else if (contents instanceof StaticArray) {
    if (isReference<valueof<T>>()) ERROR("Cannot call write if type of valueof<T> is a reference.");
    // @ts-ignore: T is a StaticArray<U> and valueof<T> returns U
    let byteLength = (<usize>contents.length) << (alignof<valueof<T>>());
    return writeFileUnsafe(
      changetype<usize>(pathPtr),
      pathLen,
      changetype<usize>(contents),
      byteLength,
      lookupflags.SYMLINK_FOLLOW,
      fdrights,
      fdoflags,
    );
  }
  return new UnmanagedResult<usize>(0, "Invalid data type.");
}

export function readFile(path: string): UnmanagedResult<StaticArray<u8> | null> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  let fdrights: rights = rights.FD_READ
                       | rights.FD_SEEK
                       | rights.FD_TELL
                       | rights.FD_FILESTAT_GET
                       | rights.FD_READDIR;
  let fdoflags: oflags = 0;
  if (fdrights == u64.MAX_VALUE || fdoflags == u16.MAX_VALUE) return new UnmanagedResult<StaticArray<u8> | null>(null, "Invalid flags.");
  return readFileUnsafe(changetype<usize>(pathPtr), pathLen, lookupflags.SYMLINK_FOLLOW, fdrights, fdoflags);
}

export function readDir(path: string): UnmanagedResult<Dirent[] | null> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  // let parsedFlags = parseFlags(flags);
  // if (!parsedFlags) return new UnmanagedResult<Dirent[] | null>(null, "Invalid flags.");

  let fdrights: rights = 0;
  let fdoflags: oflags = 0;

  // we always want to readdir, and fail if not a directory
  fdrights |= rights.FD_READDIR;
  fdoflags |= oflags.DIRECTORY;

  return readDirUnsafe(changetype<usize>(pathPtr), pathLen, lookupflags.SYMLINK_FOLLOW, fdrights, fdoflags);
}

