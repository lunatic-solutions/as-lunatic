import { Maybe, MaybeCallbackContext } from "../managed/maybe";
import { Box } from "../message";
import { fstat, readDir, readFileStaticArray, readFileBuffer, rename, unlink, writeFile, mkdir } from "./sync";
import { Dirent, FStat } from "./util";

export class WriteFileMaybeContext<T> {
  constructor(
    public path: string,
    public contents: T,
    public encoding: string,
  ) {}
}

/** Write a file to disk, return a maybe. */
export function writeFileMaybe<T>(path: string, contents: T, flags: string = "w"): Maybe<usize, string> {
  let ctx = new WriteFileMaybeContext<T>(path, contents, flags);
  return Maybe.resolve<WriteFileMaybeContext<T>, i32>(ctx)
    .then<usize, string>((value: Box<WriteFileMaybeContext<T>> | null, ctx: MaybeCallbackContext<usize, string>) => {
      let startCtx = value!.value;
      let result = writeFile<T>(startCtx.path, startCtx.contents, startCtx.encoding);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value);
      }
    });
}

/** Read a file into a StaticArray asynchronously and return a Maybe. */
export function readFileStaticArrayMaybe(path: string): Maybe<StaticArray<u8>, string> {
  return Maybe.resolve<string, i32>(path)
    .then<StaticArray<u8>, string>((value: Box<string> | null, ctx: MaybeCallbackContext<StaticArray<u8>, string>) => {
      let result = readFileStaticArray(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}
/** Read a file into an ArrayBuffer asynchronously and return a Maybe. */
export function readFileBufferMaybe(path: string): Maybe<ArrayBuffer, string> {
  return Maybe.resolve<string, i32>(path)
    .then<ArrayBuffer, string>((value: Box<string> | null, ctx: MaybeCallbackContext<ArrayBuffer, string>) => {
      let result = readFileBuffer(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

/** Read the contents of a directory returning an array of Dirent, asynchronously. */
export function readDirMaybe(path: string): Maybe<Dirent[], string> {
  return Maybe.resolve<string, i32>(path)
    .then<Dirent[], string>((value: Box<string> | null, ctx: MaybeCallbackContext<Dirent[], string>) => {
      let result = readDir(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

/** Get file stats of a file asynchronously. */
export function fstatMaybe(path: string): Maybe<FStat, string> {
  return Maybe.resolve<string, i32>(path)
    .then<FStat, string>((value: Box<string> | null, ctx: MaybeCallbackContext<FStat, string>) => {
      let result = fstat(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

export class RenameMaybeContext {
  constructor(
    public oldPath: string,
    public newPath: string,
  ) {}
}

/** Rename a directory or a file. */
export function renameMaybe(oldPath: string, newPath: string): Maybe<bool, string> {
  return Maybe.resolve<RenameMaybeContext, i32>(new RenameMaybeContext(oldPath, newPath))
    .then<bool, string>((value: Box<RenameMaybeContext> | null, ctx: MaybeCallbackContext<bool, string>) => {
      let result = rename(value!.value.oldPath, value!.value.newPath);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

/** Delete a file or directory on another process, and return a Maybe. */
export function unlinkMaybe(path: string): Maybe<bool, string> {
  return Maybe.resolve<string, i32>(path)
    .then<bool, string>((value: Box<string> | null, ctx: MaybeCallbackContext<bool, string>) => {
      let result = unlink(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

/** Make a dir asynchronously on another process */
export function mkdirMaybe(path: string): Maybe<bool, string> {
  return Maybe.resolve<string, i32>(path)
    .then<bool, string>((value: Box<string> | null, ctx: MaybeCallbackContext<bool, string>) => {
      let result = mkdir(value!.value);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value!);
      }
    });
}

