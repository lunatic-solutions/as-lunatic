import { Maybe, MaybeCallbackContext } from "../managed/maybe";
import { Box } from "../message";
import { writeFile } from "./sync";

export class WriteWhileMaybeContext<T> {
  constructor(
    public path: string,
    public contents: T,
    public flags: string,
    public encoding: string,
  ) {}
}

export function writeWhileMaybe<T>(path: string, contents: T, flags: string = "w", encoding: string = "utf8"): Maybe<usize, string> {
  let ctx = new WriteWhileMaybeContext<T>(path, contents, flags, encoding);
  return Maybe.resolve<WriteWhileMaybeContext<T>, i32>(ctx)
    .then<usize, string>((value: Box<WriteWhileMaybeContext<T>> | null, ctx: MaybeCallbackContext<usize, string>) => {
      let startCtx = value!.value;
      let result = writeFile<T>(startCtx.path, startCtx.contents, startCtx.flags, startCtx.encoding);
      if (result.error) {
        ctx.reject(result.error);
      } else {
        ctx.resolve(result.value);
      }
    });
}
