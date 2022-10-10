import { idPtr, Result } from "../error";
import { ErrCode } from "../util";
import { dns } from "./bindings";
import { IPAddress, ipAddressPointer } from "./util";

/**
 * Resolve a hostname it it's given IPResolutions.
 *
 * @param {string} host - The host to be resolved.
 * @param {u32} timeout - The timeout.
 * @returns {Result<IPAddress[] | null>} The resulting IPResolution set.
 */
export function resolve(host: string, timeout: u32 = 0): Result<IPAddress[] | null> {
  // encode the string to utf8
  let namePtr = String.UTF8.encode(host);

  // resolve the host
  let result = dns.resolve(changetype<usize>(namePtr), <usize>namePtr.byteLength, timeout, idPtr);

  // process the result
  let id = load<u64>(idPtr);
  if (result == ErrCode.Success) {
    let value: IPAddress[] = resolveDNSIterator(id);
    return new Result<IPAddress[] | null>(value);
  }
  return new Result<IPAddress[] | null>(null, id);
}

/**
 * Resolve the contents of a DNS Iterator.
 * @param {u64} id - The dns iterator id.
 * @returns {IPAddress[]} The IPResolution array.
 */
 export function resolveDNSIterator(id: u64): IPAddress[] {
  let value: IPAddress[] = [];

  // obtain the ip resolutions
  while (dns.resolve_next(id,
    ipAddressPointer + offsetof<IPAddress>("type"),
    ipAddressPointer,
    ipAddressPointer + offsetof<IPAddress>("port"),
    ipAddressPointer + offsetof<IPAddress>("flowInfo"),
    ipAddressPointer + offsetof<IPAddress>("scopeId")) == ErrCode.Success) {
    // IPResolution will automatically load from the pointers
    value.push(IPAddress.load());
  }

  // always drop if successful
  dns.drop_dns_iterator(id);
  return value;
}
