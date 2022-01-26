
export namespace error {

    /**
     * Obtain the length of an error string.
     *
     * @param {u64} id - The id of the error.
     * @returns {usize} The length of the string.
     */
    // @ts-ignore: external is valid here
    @external("lunatic::error", "string_size")
    export declare function string_size(id: u64): usize;


    /**
     * Write the utf8 string into memory.
     *
     * @param {u64} id - The error id.
     * @param {usize} ptr [*mut u8] The pointer to memory where it will be written.
     */
    // @ts-ignore
    @external("lunatic::error", "to_string")
    export declare function to_string(id: u64, ptr: usize): void;

    /**
     * Drop the error
     *
     * @param {u64} id - The error id.
     */
    // @ts-ignore
    @external("lunatic::error", "drop")
    export declare function drop_error(id: u64): void;
}
