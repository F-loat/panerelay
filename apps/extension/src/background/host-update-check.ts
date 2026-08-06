export function createHostUpdateCheck(): () => boolean {
  let pending = true;
  return () => {
    const requested = pending;
    pending = false;
    return requested;
  };
}
