import { device, filesize, filetype, inode, iovec, linkcount, oflags, rights, timestamp } from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";

export class Dirent {
  constructor(
    public type: filetype,
    public name: string,
  ) {}

  isBlockDevice(): bool {
    return this.type == filetype.BLOCK_DEVICE;
  }

  isCharacterDevice(): bool {
    return this.type == filetype.CHARACTER_DEVICE;
  }

  isDirectory(): bool {
    return this.type == filetype.DIRECTORY;
  }

  isFile(): bool {
    return this.type == filetype.REGULAR_FILE;
  }

  isSocket(): bool {
    return bool(i32(this.type == filetype.SOCKET_DGRAM) | i32(this.type == filetype.SOCKET_STREAM));
  }

  isSymbolicLink(): bool {
    return this.type == filetype.SYMBOLIC_LINK;
  }
}

export class FStat {
  constructor(
    /** Device ID of device containing the file. */
    public dev: device,
    /** File serial number. */
    public ino: inode,
    /** File type. */
    public filetype: filetype,
    /** Number of hard links to the file. */
    public nlink: linkcount,
    /** For regular files, the file size in bytes. For symbolic links, the length in bytes of the pathname contained in the symbolic link. */
    public size: filesize,
    /** Last data access timestamp. */
    public atim: timestamp,
    /** Last data modification timestamp. */
    public mtim: timestamp,
    /** Last file status change timestamp. */
    public ctim: timestamp,
  ) {}
}


// 0 is out, 1 is in, 2 is err, 3 is preopened dir cwd, AS-WASI
@lazy export const ROOT_FD: u32 = <u32>3;
@lazy export const FD_PTR = memory.data(sizeof<u32>());
export const ioVector = changetype<iovec>(memory.data(offsetof<iovec>()));
