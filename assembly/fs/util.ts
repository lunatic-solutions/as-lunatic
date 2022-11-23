import { filetype, iovec, oflags, rights } from "@assemblyscript/wasi-shim/assembly/bindings/wasi_snapshot_preview1";

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

@lazy export const ROOT_FD: u32 = <u32>3;
@lazy export const FD_PTR = memory.data(sizeof<u32>());
export const ioVector = changetype<iovec>(memory.data(offsetof<iovec>()));


export function parseOFlags(flags: string): oflags {
  if (flags.charCodeAt(0) == 0x72) {
    if (flags == "r") {
      return 0;
    } else if (flags == "r+") {
      return 0;
    } else return u16.MAX_VALUE;
  } else if (flags.charCodeAt(0) == 0x77) {
    if (flags == "w") {
      return oflags.CREAT | oflags.TRUNC;
    } else if (flags == "wx") {
      return oflags.CREAT | oflags.TRUNC | oflags.EXCL;
    } else if (flags == "w+") {
      return oflags.CREAT | oflags.TRUNC;
    } else if (flags == "wx+") {
      return oflags.CREAT | oflags.TRUNC | oflags.EXCL;      
    } else return u16.MAX_VALUE;
  } else return u16.MAX_VALUE;
}

export function parseRights(flags: string): rights {
  // "r"
  if (flags.charCodeAt(0) == 0x72) {
    if (flags == "r") {
      return rights.FD_READ | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.FD_READDIR;
    } else if (flags == "r+") {
      return rights.FD_WRITE |
        rights.FD_READ | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.PATH_CREATE_FILE;
    } else return u64.MAX_VALUE;
  } else if (flags.charCodeAt(0) == 0x77) {
    if (flags == "w") {
      return rights.FD_WRITE | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.PATH_CREATE_FILE;
    } else if (flags == "wx") {
      return rights.FD_WRITE | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.PATH_CREATE_FILE;
    } else if (flags == "w+") {
      return rights.FD_WRITE |
        rights.FD_READ | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.PATH_CREATE_FILE;
    } else if (flags == "wx+") {
      return rights.FD_WRITE |
        rights.FD_READ | rights.FD_SEEK | rights.FD_TELL | rights.FD_FILESTAT_GET |
        rights.PATH_CREATE_FILE;
    } else return u64.MAX_VALUE;
  } else return u64.MAX_VALUE;
}
