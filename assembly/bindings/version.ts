
/**
 * Version bindings functions.
 */
export namespace version {
    // @ts-ignore: external is valid here
    @external("lunatic::version", "major")
    export declare function major(): i32;
    // @ts-ignore: external is valid here
    @external("lunatic::version", "minor")
    export declare function minor(): i32;
    // @ts-ignore: external is valid here
    @external("lunatic::version", "patch")
    export declare function patch(): i32;
}
