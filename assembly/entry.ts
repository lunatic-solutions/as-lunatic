/** Required lunatic export to make processes start. */
export function __lunatic_process_bootstrap(index: u32): void {
  trace("This is running now!");
  call_indirect(index, 0);
}
