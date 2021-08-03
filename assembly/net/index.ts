import { iovec } from "bindings/wasi";
import { err_code, getError } from "../error";

/**
 * Resolve a hostname to an array of ip addresses.
 *
 * @param {usize} name_ptr - A pointer to the hostname to be resolved.
 * @param {usize} name_len - The length of the hostname string.
 * @param {usize} resolver_id - A pointer to a u32 that will contain the result id
 * that represents an iterator.
 * @returns {ResolveResult} The Resolution result.
 */
// @ts-ignore: valid decorator
@external("lunatic", "resolve")
declare function lunatic_resolve(
  name_ptr: usize /* *const u8 */,
  name_len: usize,
  resolver_id: usize /* *mut u64 */
): err_code;

/**
 * The iterator result.
 */
const enum ResolveNextResult {
  /** This value indicates there are more IP addresses to be iterated over. */
  Success = 0,
  /** The IP addresses are exhausted, and iteration is complete. */
  Done = 1,
}

/**
 * Write the next IP address into memory if it exists.
 *
 * @param {u64} resolver_id - The iterator id.
 * @param {usize} addr - A pointer to 16 allocated bytes to write the resolved IP address.
 * @param {usize} addr_len - A pointer to a usize to write the length of the resolved IP address.
 * @param {usize} port - A pointer to a u16 to write the port number of the resolved IP address.
 * @param {usize} flowinfo - A pointer to a u32 to write the flowinfo of the resolved IP address.
 * @param {usize} scope_id - A pointer to a u32 to write the scope_id of the resolved IP address.
 * @returns {ResolveNextResult} The result of iterating over the next IP address. If it returns
 * Success, there is another IP address to retrieve.
 */
// @ts-ignore: valid decorator
@external("lunatic", "resolve_next")
declare function resolve_next(
  resolver_id: u64,
  addr: usize /* *mut u8 */,
  addr_len: usize /* *mut usize */,
  port: usize /* *mut u16 */,
  flowinfo: usize /* *mut u32 */,
  scope_id: usize /* *mut u32 */,
): ResolveNextResult;

/**
 * Free an ip resolution iterator.
 *
 * @param {u64} id - The iterator id.
 */
@external("lunatic", "drop_dns_iterator")
declare function drop_dns_iterator(id: u64): void;

/** Represents the result of an operation. */
export class TCPResult<T> {
  constructor(
    public message: string | null,
    public value: T,
  ) {}
}

/**
 * A resulting IPResolution.
 */
export class IPResolution {
  /** An array of bytes representing the IP address. */
  address: StaticArray<u8> | null = null;
  /** The length of the IP address. 4 or 16. */
  addr_len: usize;
  /** The port. */
  port: u16;
  /** The flow info. */
  flowinfo: u32;
  /** The scope_id. */
  scope_id: u32;
}

/** A pointer to an ip resolution iterator. */
const resolverIdPtr = memory.data(sizeof<u64>());

/**
 * Resolve an ip address from a host name.
 *
 * @param {string} host - The host or ip address name that should be resolved.
 * @returns {IPResolution[] | null} null if the IP could not be resolved.
 */
export function resolve(host: string): TCPResult<IPResolution[] | null> {
  // encode the ip address to utf8
  let ipBuffer = String.UTF8.encode(host);
  // call the host to resolve the IP address
  let resolveResult = lunatic_resolve(
    changetype<usize>(ipBuffer),
    ipBuffer.byteLength,
    // write the resolver to memory
    resolverIdPtr
  );

  if (resolveResult == err_code.Success) {
    // read the resolver id
    let resolverId = load<u64>(resolverIdPtr);

    // loop over each IPResolution and add it to the list
    let ipArray = new Array<IPResolution>(0);
    while (true) {
      // must always allocate 16 bytes
      let buffer = new StaticArray<u8>(16);
      let resolution = new IPResolution();
      resolution.address = buffer;

      // the host iterates over each result until it returns Done
      let resolutionResult = resolve_next(
        resolverId,
        changetype<usize>(buffer),
        changetype<usize>(resolution) + offsetof<IPResolution>("addr_len"),
        changetype<usize>(resolution) + offsetof<IPResolution>("port"),
        changetype<usize>(resolution) + offsetof<IPResolution>("flowinfo"),
        changetype<usize>(resolution) + offsetof<IPResolution>("scope_id"),
      );
      if (resolutionResult == ResolveNextResult.Done) break;
      ipArray.push(resolution);
    }
    drop_dns_iterator(resolverId);
    return new TCPResult<IPResolution[] | null>(null, ipArray);
  } else {
    return new TCPResult<IPResolution[] | null>(
      getError(load<u64>(resolverIdPtr)),
      null,
    );
  }
}
