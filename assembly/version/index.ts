import { version } from "../bindings";

export namespace Version {
    /** Get a static array containing the version numbers of the lunatic version. */
    export function getVersion(): StaticArray<i32> {
        return [
            version.major(),
            version.minor(),
            version.patch(),
        ];
    }
}