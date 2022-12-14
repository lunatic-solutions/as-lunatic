import { OBJECT, TOTAL_OVERHEAD } from "assemblyscript/std/assembly/rt/common";
import { Box } from ".";
import { message } from "./bindings";

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
  id: u32;
  size: u32;
}

export const entryHeader = changetype<EntryHeader>(memory.data(offsetof<EntryHeader>()));








export const enum InstructionType {
  None,
  PushObject,
  PopField,
  PopSetItem,
  PushSet,
  PushArray
}

@unmanaged class InstructionHeader {
  type: InstructionType;
  offset: u32;
}

export const instructionHeader  = changetype<InstructionHeader>(memory.data(offsetof<InstructionHeader>()));

@global export class Serializer {
  serialize<T>(value: T): void {
    if (value instanceof Object) {
      this.serializeObject(value);
    } else {
      this.serializeObject(new Box<T>(value));
    }
  }

  serializeObject<T>(obj: T): void {
    if (obj instanceof Set) {
      this.serializeSet(obj);
    } else if (obj instanceof Map) {
      
    } else if (obj instanceof Array) {
      this.serializeArray(obj);
    } else {
      // @ts-ignore: Custom Serialization may exist
      if (isDefined(obj.__aslunaticCustomSerialize)) {
        // @ts-ignore: Custom Serialization may exist
        obj.__aslunaticCustomSerialize();
      } else {
        this.serializeDefault<T>(obj);
      }
    }
  }

  serializeDefault<T>(obj: T) {
    this.writeInstruction(InstructionType.PushObject, 0);
    this.writeRawObject(obj);
    // @ts-ignore: This interface exists globally
    (obj as IASLunaticSerialize).__aslunaticSerialize(this);
  }

  serializeSet<T>(obj: T): void {
    if (isReference<indexof<T>>()) {
      this.writeInstruction(InstructionType.PushSet, 0);

      let start = load<usize>(changetype<usize>(obj), offsetof<T>("entries"));
      let size = load<i32>(changetype<usize>(obj), offsetof<T>("entriesOffset"));

      for (let i = 0; i < size; ++i) {
        let entry = changetype<SetEntry<indexof<T>>>(start + <usize>i * SET_ENTRY_SIZE<T>());
        if (!(entry.taggedNext & SET_EMPTY)) {
          this.serializeObject(entry.key);
          this.writeInstruction(InstructionType.PopSetItem, 0);
        }
      }
    } else {
      this.serializeDefault(obj);
    }
  }
  serializeArray<T>(obj: T): void {
    if (isReference<valueof<T>>()) {
      this.writeInstruction(InstructionType.PushArray, 0);
      // @ts-ignore: length is defined
      for (let i = 0; i < obj.length; i++) {
        // @ts-ignore: index is defined
        let item = obj[i];
        this.serializeObject(item);
      }
    } else {
      this.serializeDefault(obj);
    }
  }

  @inline writeInstruction(type: InstructionType, offset: usize): void {
    instructionHeader.type = type;
    instructionHeader.offset = offset;
    message.write_data(changetype<usize>(instructionHeader), offsetof<InstructionHeader>());
  }
  
  @inline writeRawObject<T>(obj: T): void {
    entryHeader.id = getId(obj);
    let size = entryHeader.size = getSize(obj);
    message.write_data(changetype<usize>(entryHeader), offsetof<EntryHeader>());
    message.write_data(changetype<usize>(obj), size);
  }

  putField<T>(value: T, offset: usize): void {
    if (value instanceof Object) {
      this.serializeObject(value);
      this.writeInstruction(InstructionType.PopField, <u32>offset);
    }
  }
}
