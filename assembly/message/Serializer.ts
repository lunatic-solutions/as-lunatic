import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { Box } from ".";
import { message } from "./bindings";

/** Empty bit. */
// @ts-ignore: decorator
@inline const MAP_EMPTY: usize = 1 << 0;

/** Structure of a map entry. */
@unmanaged class MapEntry<K,V> {
  key: K;
  value: V;
  taggedNext: usize; // LSB=1 indicates EMPTY
}

/** Computes the alignment of an entry. */
// @ts-ignore: decorator
@inline
function MAP_ENTRY_ALIGN<K,V>(): usize {
  // can align to 4 instead of 8 if 32-bit and K/V is <= 32-bits
  const maxkv = sizeof<K>() > sizeof<V>() ? sizeof<K>() : sizeof<V>();
  const align = (maxkv > sizeof<usize>() ? maxkv : sizeof<usize>()) - 1;
  return align;
}

/** Computes the aligned size of an entry. */
// @ts-ignore: decorator
@inline
function MAP_ENTRY_SIZE<K,V>(): usize {
  const align = MAP_ENTRY_ALIGN<K,V>();
  const size = (offsetof<MapEntry<K,V>>() + align) & ~align;
  return size;
}

/** Empty bit. */
// @ts-ignore: decorator
@inline const SET_EMPTY: usize = 1 << 0;

/** Computes the alignment of an entry. */
// @ts-ignore: decorator
@inline
function SET_ENTRY_ALIGN<T>(): usize {
  // can align to 4 instead of 8 if 32-bit and K is <= 32-bits
  const align = (sizeof<T>() > sizeof<usize>() ? sizeof<T>() : sizeof<usize>()) - 1;
  return align;
}

/** Computes the aligned size of an entry. */
// @ts-ignore: decorator
@inline
function SET_ENTRY_SIZE<T>(): usize {
  const align = SET_ENTRY_ALIGN<T>();
  const size = (offsetof<SetEntry<T>>() + align) & ~align;
  return size;
}

/** Structure of a set entry. */
@unmanaged class SetEntry<K> {
  key: K;
  taggedNext: usize; // LSB=1 indicates EMPTY
}

// @ts-ignore: valid inline
@inline function getSize<T>(value: T): usize {
  return changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD).rtSize;
}
// @ts-ignore: valid inline
@inline function getId<T>(value: T): u32 {
  return changetype<OBJECT>(changetype<usize>(value) - TOTAL_OVERHEAD).rtId;
}

@unmanaged class EntryHeader {
  id: i32;
  rttid: u32;
  size: u32;
}

export const entryHeader = changetype<EntryHeader>(memory.data(offsetof<EntryHeader>()));

@unmanaged export class ValueHeader {
  size: u32;
  integer: bool;
}

export const valueHeader = changetype<ValueHeader>(memory.data(offsetof<ValueHeader>()));

export const enum InstructionType {
  None,
  PushObject,
  PopField,
  PopSetItem,
  PushSet,
  PushArray,
  PushCircular,
  PopArrayItem,
  PopMapKey,
  PopMapValue,
  PushValue,
  Null,
  Custom
}

@unmanaged class InstructionHeader {
  type: InstructionType;
  offset: u32;
}

export const instructionHeader  = changetype<InstructionHeader>(memory.data(offsetof<InstructionHeader>()));

@global export class Serializer {
  id: i32 = 0;
  seen: Map<Object, i32> = new Map<usize, i32>();

  serialize<T>(value: T): void {
    this.id = 0;
    this.seen.clear();
    if (value instanceof Object) {
      this.serializeObject(value);
    } else {
      this.serializeObject(new Box<T>(value));
    }
  }

  serializeObject<T>(obj: T): void {
    // @ts-ignore: obj is an object here
    if (this.seen.has(obj)) {
      // @ts-ignore: obj is an object here
      this.writeInstruction(InstructionType.PushCircular, this.seen.get(obj));
      return;
    }

    if (obj instanceof Set) {
      this.serializeSet(obj);
    } else if (obj instanceof Map) {
      
    } else if (obj instanceof Array) {
      this.serializeArray(obj);
    } else {
      // @ts-ignore: Custom Serialization may exist
      if (isDefined(obj.__lunaticCustomSerialize)) {
        this.serializeCustom(obj);
      } else {
        this.serializeDefault<T>(obj);
      }
    }
  }

  serializeCustom<T>(obj: T): void {
    let buffer = obj.__lunaticCustomSerialize();
    let byteLength = getByteLength(buffer);
    this.writeInstruction(InstructionType.Custom, byteLength);
    this.writeRawSegment(changetype<usize>(buffer), byteLength)
  }

  serializeDefault<T>(obj: T): void {
    this.writeInstruction(InstructionType.PushObject);
    this.writeRawObject(obj);
    // @ts-ignore: This interface exists globally
    (obj as LunaticInternalTransformInterface).__lunaticSerialize(this);
  }

  serializeSet<T>(obj: T): void {
    if (isReference<indexof<T>>()) {
      this.writeInstruction(InstructionType.PushSet);

      let start = load<usize>(changetype<usize>(obj), offsetof<T>("entries"));
      let size = load<i32>(changetype<usize>(obj), offsetof<T>("entriesOffset"));

      for (let i = 0; i < size; ++i) {
        let entry = changetype<SetEntry<indexof<T>>>(start + <usize>i * SET_ENTRY_SIZE<T>());
        if (!(entry.taggedNext & SET_EMPTY)) {
          this.serializeObject(entry.key);
          this.writeInstruction(InstructionType.PopSetItem);
        }
      }
    } else {
      this.serializeDefault(obj);
    }
  }

  serializeMap<T>(obj: T): void {
    if (i32(isReference<indexof<T>>()) | i32(isReference<valueof<T>>())) {
      let start = load<usize>(changetype<usize>(obj), offsetof<T>("entries"));
      let size = load<i32>(changetype<usize>(obj), offsetof<T>("entriesOffset"));

      for (let i = 0; i < size; ++i) {
        let entry = changetype<MapEntry<indexof<T>, valueof<T>>>(start + <usize>i * MAP_ENTRY_SIZE<indexof<T>, valueof<T>>());
        if (!(entry.taggedNext & MAP_EMPTY)) {
          let key = entry.key;
          let value = entry.value;
          this.serializeValue(key);
          this.writeInstruction(InstructionType.PopMapKey);
          this.serializeValue(value);
          this.writeInstruction(InstructionType.PopMapValue);
        }
      }
    } else {
      this.serializeDefault(obj);
    }
  }

  serializeValue<T>(value: T): void {
    if (value instanceof Object) {
      this.serializeObject(value);
      return;
    }

    this.writeInstruction(InstructionType.PushValue);
    this.writeRawValue(value);
  }

  serializeArray<T>(obj: T): void {
    if (isReference<valueof<T>>()) {
      this.writeInstruction(InstructionType.PushArray);
      // @ts-ignore: length is defined
      for (let i = 0; i < obj.length; i++) {
        // @ts-ignore: index is defined
        let item = obj[i];
        this.serializeObject(item);
        this.writeInstruction(InstructionType.PopArrayItem);
      }
    } else {
      this.serializeDefault(obj);
    }
  }

  @inline writeRawValue<T>(value: T): void {
    valueHeader.size = sizeof<T>();
    valueHeader.integer = isInteger(value);
    message.write_data(changetype<usize>(valueHeader), offsetof<ValueHeader>());
    let ptr = memory.data(sizeof<u64>());
    store<T>(ptr, value);
    message.write_data(ptr, sizeof<T>());
  }

  @inline writeInstruction(type: InstructionType, offset: usize = 0): void {
    instructionHeader.type = type;
    instructionHeader.offset = offset;
    message.write_data(changetype<usize>(instructionHeader), offsetof<InstructionHeader>());
  }
  
  @inline writeRawObject<T>(obj: T): void {
    let id = this.id++;
    entryHeader.id = id;
    entryHeader.rttid = getId(obj);
    let size = entryHeader.size = getSize(obj);
    message.write_data(changetype<usize>(entryHeader), offsetof<EntryHeader>());
    message.write_data(changetype<usize>(obj), size);
    this.seen.set(changetype<usize>(obj), id);
  }

  @inline writeRawSegment(ptr: usize, byteLength: usize): void {
    message.write_data(ptr, byteLength);
  }

  putField<T>(value: T, offset: usize): void {
    if (value instanceof Object) {
      if (changetype<usize>(value) == 0) {
        this.writeInstruction(InstructionType.Null);
        this.writeInstruction(InstructionType.PopField, <u32>offset);
        return;
      }
      if (isNullable(value)) {
        this.serializeObject(value!);
      } else {
        this.serializeObject(value);
      }
      this.writeInstruction(InstructionType.PopField, <u32>offset);
    }
  }
}
