import { idPtr, Result } from "../error";
import { Process } from "../process";
import { ErrCode, opaquePtr } from "../util";
import { registry } from "./bindings";

export namespace Registry {
  /** Put a process into the registry with the given name. */
  export function put<T>(name: string, process: Process<T>): void {
    let buffer = String.UTF8.encode(name);
    registry.put(changetype<usize>(buffer), <usize>buffer.byteLength, process.nodeID, process.id);
  }


  /** Get a process from the registry, returns null if it cannot be found. */
  export function get<T>(name: string): Process<T> | null {
    let buffer = String.UTF8.encode(name);
    let result = registry.get(changetype<usize>(buffer), <usize>buffer.byteLength, opaquePtr, idPtr);
    if (result == ErrCode.Fail) return null;
    let nodeID = load<u64>(opaquePtr);
    let processID = load<u64>(idPtr);
    return new Process<T>(processID, Process.tag++, nodeID);
  }

  /** Remove a process from the registry if it exists. */
  export function remove(name: string): void {
    let buffer = String.UTF8.encode(name);
    registry.remove(changetype<usize>(buffer), <usize>buffer.byteLength);
  }
}