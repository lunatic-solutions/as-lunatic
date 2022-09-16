import { Process } from "../process";

export namespace Distributed {
  /** Return a reference to the current process. */
  export function self<T>(): Process<T> {
    return new Process<T>(Process.processID, Process.tag++, Process.node);
  }
}