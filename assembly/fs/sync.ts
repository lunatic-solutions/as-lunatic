import {
  oflags,
  rights,
  lookupflags,
  iovec,
} from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";
import { UnmanagedResult } from "../error";
import { OBJECT, TOTAL_OVERHEAD } from "rt/common";
import { fstatUnsafe, mkdirUnsafe, readDirUnsafe, readFileUnsafe, renameUnsafe, unlinkUnsafe, writeFileUnsafe } from "./unsafe";
import { Dirent, FStat } from "./util";

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
    // @ts-ignore: T is a StaticArray<U> and valueof<T> returns U
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
    // @ts-ignore: T is a StaticArray<U> and valueof<T> returns U
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

/** Read the contents of a file into a static array. */
export function readFileStaticArray(path: string): UnmanagedResult<StaticArray<u8> | null> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  let fdrights: rights = rights.FD_READ
                       | rights.FD_SEEK
                       | rights.FD_TELL
                       | rights.FD_FILESTAT_GET
                       | rights.FD_READDIR;
  let fdoflags: oflags = 0;
  return readFileUnsafe<StaticArray<u8>>(changetype<usize>(pathPtr), pathLen, lookupflags.SYMLINK_FOLLOW, fdrights, fdoflags);
}

/** Read the contents of a file into a static array. */
export function readFileBuffer(path: string): UnmanagedResult<ArrayBuffer | null> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  let fdrights: rights = rights.FD_READ
                       | rights.FD_SEEK
                       | rights.FD_TELL
                       | rights.FD_FILESTAT_GET
                       | rights.FD_READDIR;
  let fdoflags: oflags = 0;
  return readFileUnsafe<ArrayBuffer>(changetype<usize>(pathPtr), pathLen, lookupflags.SYMLINK_FOLLOW, fdrights, fdoflags);
}

export function readDir(path: string): UnmanagedResult<Dirent[] | null> {
  let pathPtr = String.UTF8.encode(path);
  let pathLen = <usize>pathPtr.byteLength;

  // we always want to readdir, and fail if not a directory
  let fdrights: rights = rights.FD_READDIR;
  let fdoflags: oflags = oflags.DIRECTORY;

  return readDirUnsafe(changetype<usize>(pathPtr), pathLen, lookupflags.SYMLINK_FOLLOW, fdrights, fdoflags);
}

export function fstat(path: string): UnmanagedResult<FStat | null> {
  let buffer = String.UTF8.encode(path);
  return fstatUnsafe(changetype<usize>(buffer), <usize>buffer.byteLength);
}

export function rename(oldPath: string, newPath: string): UnmanagedResult<bool> {
  let oldPathPtr = String.UTF8.encode(oldPath);
  let newPathPtr = String.UTF8.encode(newPath);

  return renameUnsafe(
    changetype<usize>(oldPathPtr),
    <usize>oldPathPtr.byteLength,
    changetype<usize>(newPathPtr),
    <usize>newPathPtr.byteLength,
  );
}

export function unlink(path: string): UnmanagedResult<bool> {
  let pathPtr = String.UTF8.encode(path);
  return unlinkUnsafe(changetype<usize>(pathPtr), <usize>pathPtr.byteLength);
}

/** Make a directory. */
export function mkdir(path: string): UnmanagedResult<bool> {
  let pathPtr = String.UTF8.encode(path);
  return mkdirUnsafe(changetype<usize>(pathPtr), <usize>pathPtr.byteLength);
}
