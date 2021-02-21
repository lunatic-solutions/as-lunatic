export const enum CharCode {
  _0 = 0x30,
  _9 = 0x39,
  dot = 0x2E,
  colon = 0x3A,
  a = 0x61,
  f = 0x66,
  A = 0x41,
  F = 0x46,
}

// @ts-ignore force inlining
@inline
function betweenInclusive(val: u16, start: u16, end: u16): i32 {
  return i32(val >= start) & i32(val <= end);
}

// @ts-ignore force inlining
@inline
function isDigit(char: u16, isHex: bool): bool {
  return bool(betweenInclusive(char, <u16>CharCode._0, <u16>CharCode._9)
   | (i32(isHex) & (betweenInclusive(char, <u16>CharCode.A, <u16>CharCode.F) | betweenInclusive(char, <u16>CharCode.a, <u16>CharCode.f))));
}

export const ipOutput = memory.data(16); // static segment for output
export const portOutput = memory.data(2); // u16 for port
export const byteOutput = memory.data(1); // single byte for consumeOctet output

export class IP {
  public constructor(
    public isv6: bool,
    public bytes: StaticArray<u8>,
    public port: u16,
  ) {}
}

export function getIP(isv6: bool): IP {
  let length = select<i32>(16, 4, isv6);
  let bytes = new StaticArray<u8>(length);
  memory.copy(changetype<usize>(bytes), ipOutput, length);
  return new IP(
    isv6,
    bytes,
    load<u16>(portOutput),
  );
}

export function tryParseIPV4(input: usize, byteLength: usize): bool {
  let offset = <usize>0;
  // three times, consume octet + "."
  for (let i = 0; i < 3; i++) {
    let advance = tryParseOctet(input, byteLength, offset);
    if (advance == 0) return false;
    offset += advance;
    if (!tryConsumeCode(input, byteLength, offset, <u16>CharCode.dot)) return false;
    offset += 2;
    let byte = load<u8>(byteOutput);
    store<u8>(ipOutput + <usize>i, byte);
  }

  // then consume one last octet
  let advance = tryParseOctet(input, byteLength, offset);
  if (advance == 0) return false;
  offset += advance;
  let byte = load<u8>(byteOutput);
  store<u8>(ipOutput, byte, 3);

  if (tryConsumeCode(input, byteLength, offset, <u16>CharCode.colon)) {
    offset += 2;
    advance = tryParsePort(input, byteLength, offset);
    if (advance > 0) {
      offset += advance;
      return offset == byteLength;
    } else return false; // no port after colon error
  } else {
    // no port? set it to 0 just in case
    store<u16>(portOutput, 0);
    return offset == byteLength;
  }
}

function tryConsumeCode(input: usize, byteLength: usize, offset: usize, code: u16): bool {
  if (offset >= byteLength) return false;
  let char = load<u16>(input + offset);
  return char == code;
}

const CHAR_CONVERSION_CONST: u16 = 0x0030;

function tryParseOctet(input: usize, byteLength: usize, offset: usize): usize {
  let ptr = input + offset;
  if (offset >= byteLength) return 0; // consume nothing
  let char1: u16 = load<u16>(ptr);
  let char2: u16 = 0;
  let char3: u16 = 0;
  let consumeCount: usize = 2;
  let total: u16 = 0;
  if (offset + 2 <= byteLength && isDigit(char1, false)) {
    char2 = load<u16>(ptr, 2);
    total = char1 - CHAR_CONVERSION_CONST;
    if (offset + 4 <= byteLength && isDigit(char2, false)) {
      char3 = load<u16>(ptr, 4);
      total = total * 10 + char2 - CHAR_CONVERSION_CONST;
      if (isDigit(char3, false)) {
        consumeCount = 6;
        total = total * 10 + char3 - CHAR_CONVERSION_CONST;
      } else {
        consumeCount = 4;
      }
    }
  }

  // if this is a valid octet
  if (total <= 255) {
    store<u8>(byteOutput, <u8>total);
    return consumeCount;
  }

  return 0;
}

function tryParsePort(input: usize, byteLength: usize, offset: usize): usize {
  let advance: usize = 0;
  let total: u32 = 0;

  while (true) {
    let index = offset + advance;
    if (index >= byteLength) break;
    let char = load<u16>(input + index);
    if (!isDigit(char, false)) break;
    total = total * 10 + <u32>(char - CHAR_CONVERSION_CONST);
    advance += sizeof<u16>();
  }

  // port range must be u16 range
  if (total > 0xFFFF) {
    store<u16>(portOutput, 0);
    return 0;
  }

  store<u16>(portOutput, <u16>total);
  return advance;
}
