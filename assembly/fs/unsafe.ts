import {
  path_open, oflags, rights,
  lookupflags,
  errno,
  errnoToString, fd_close,
  fd_read,
  fd_filestat_get,
  filestat,
  filetype,
  fd_write,
  dirent,
  fd_readdir,
  dircookie
} from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";
import { UnmanagedResult } from "../error";
import { opaquePtr } from "../util";
import { Dirent, ROOT_FD, FD_PTR, ioVector } from "./util";

export function readFileUnsafe(
  pathPtr: usize,
  pathLen: usize,
  lkupflags: lookupflags,
  rights: rights,
  oflags: oflags
): UnmanagedResult<StaticArray<u8> | null> {
  let result = path_open(
    ROOT_FD,
    lkupflags,
    pathPtr,
    pathLen,
    oflags,
    rights,
    rights,
    0,
    FD_PTR
  );
  if (result != errno.SUCCESS)
    return new UnmanagedResult<StaticArray<u8> | null>(null, errnoToString(result));

  // obtain the size of the record
  let fd = load<u32>(FD_PTR);
  let rawStat = memory.data(offsetof<filestat>());
  let stat = changetype<filestat>(rawStat);
  result = fd_filestat_get(fd, stat);

  if (result != errno.SUCCESS) {
    fd_close(fd);
    return new UnmanagedResult<StaticArray<u8> | null>(null, errnoToString(result));
  }

  if (stat.filetype != filetype.REGULAR_FILE) {
    fd_close(fd);
    return new UnmanagedResult<StaticArray<u8> | null>(null, "Invalid file type.");
  }

  let size = <usize>stat.size;
  let output = new StaticArray<u8>(<i32>size);
  ioVector.buf = changetype<usize>(output);
  ioVector.buf_len = size;
  result = fd_read(fd, changetype<usize>(ioVector), 1, opaquePtr);
  fd_close(fd);

  if (result != errno.SUCCESS) {
    return new UnmanagedResult<StaticArray<u8> | null>(null, errnoToString(result));
  }
  let bytesRead = load<u64>(opaquePtr);
  assert(size == <usize>bytesRead);

  return new UnmanagedResult<StaticArray<u8> | null>(output);
}


/**
 * Write a file to the file system at the given path, returning an Unmanaged result of
 * the number of bytes written or a string error.
 */
 @unsafe export function writeFileUnsafe(
  pathPtr: usize,
  pathLen: usize,
  bytesPtr: usize,
  bytesLen: usize,
  lkupflags: lookupflags,
  rights: rights,
  oflags: oflags,
): UnmanagedResult<usize> {
  let result = path_open(
    ROOT_FD,
    lkupflags,
    pathPtr,
    pathLen,
    oflags,
    rights,
    rights,
    0,
    FD_PTR,
  );
  if (result != errno.SUCCESS) return new UnmanagedResult<usize>(0, errnoToString(result));
  let fd = load<u32>(FD_PTR);

  // we have the path open now, we *should* be able to perform an fd_write
  ioVector.buf = bytesPtr;
  ioVector.buf_len = bytesLen;
  result = fd_write(
    fd,
    changetype<usize>(ioVector),
    1,
    opaquePtr,
  );

  // once the operation is done, we need to close the fd
  fd_close(fd);

  // return the result
  return result == errno.SUCCESS
    ? new UnmanagedResult<usize>(<usize>load<u64>(opaquePtr))
    // failure should return the string
    : new UnmanagedResult<usize>(0, errnoToString(result));
}

export function readDirUnsafe(
  pathPtr: usize,
  pathLen: usize,
  lkupflags: lookupflags,
  rights: rights,
  oflags: oflags
): UnmanagedResult<Dirent[] | null> {
  let result = path_open(ROOT_FD, lkupflags, pathPtr, pathLen, oflags, rights, rights, 0, FD_PTR);
  if (result != errno.SUCCESS) {
    return new UnmanagedResult<Dirent[] | null>(null, errnoToString(result));
  }

  // start values
  let fd = load<u32>(FD_PTR);
  let size = <usize>4096;
  let ptr = heap.alloc(size);
  let bytesRead: usize = 0;
  // read until we read every entry
  while (true) {
    let result = fd_readdir(fd, ptr, size, 0 as dircookie, opaquePtr);
    bytesRead = <usize>load<u32>(opaquePtr);

    // if the read was unsuccessful we return the errno
    if (result != errno.SUCCESS) {
      heap.free(ptr);
      fd_close(fd);
      return new UnmanagedResult<Dirent[] | null>(null, errnoToString(result));
    }

    // resize thebuffer if we didn't read the whole thing, and try again
    if (bytesRead < size) break;
    size <<= 1;
    ptr = heap.realloc(ptr, size);
  }
  // always close your file descriptors
  fd_close(fd);

  // need to return a result
  let output = new Array<Dirent>();

  // now we loop over the 
  let cursor = <usize>0;
  while (cursor < bytesRead) {
    // get the dirent
    let dirent = changetype<dirent>(ptr + cursor);
    // get the namelen
    let namelen = <usize>dirent.namlen;
    
    // advance the cursor and decode the string
    cursor += offsetof<dirent>();
    let name = String.UTF8.decodeUnsafe(ptr + cursor, namelen);

    // create the result element and push it
    let element = new Dirent(dirent.type, name);
    output.push(element);

    // advance past the name length to get the next dirent
    cursor += namelen;
  }

  heap.free(ptr);
  return new UnmanagedResult<Dirent[] | null>(output);
}