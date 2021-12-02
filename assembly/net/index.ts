import { Result, id_ptr } from "../error";
import { net } from "../bindings";
import { err_code } from "..";

export const enum IPType {
  None = 0,
  IPV4 = 4,
  IPV6 = 6,
}

export class IPResolution {
  // allocate 16 bytes for the address
  private _address_1: u64 = 0;
  private _address_2: u64 = 0;
  public type: IPType = IPType.None;

  public get ip(): StaticArray<u8> {
    let type = this.type;
    if (type == IPType.None) assert(false);
    let result = new StaticArray<u8>(4);
    memory.copy(changetype<usize>(result), changetype<usize>(this), select<usize>(i32(type == IPType.IPV4), 16, 4));
    return result;
  }


}

export function resolve(host: string, timeout: u32 = 0): Result<IPResolution[] | null> {
  // encode the string to utf8
  let name_ptr = String.UTF8.encode(host);

  // resolve the host
  let result = net.resolve(changetype<usize>(name_ptr), <usize>name_ptr.byteLength, timeout, id_ptr);

  // process the result
  let id = load<u64>(id_ptr);
  if (result == err_code.Success) {
    let value: IPResolution[] = [];

    // obtain the ip resolutions

    // always drop
    net.drop_dns_iterator(id);
    return new Result<IPResolution[] | null>(value);
  } 
  return new Result<IPResolution[] | null>(null, id);
}
