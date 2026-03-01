export function SafariTintProbe() {
  return (
    <>
      <div
        aria-hidden="true"
        className="fixed left-[5%] right-[5%] top-0 h-1 pointer-events-none bg-background"
      />
      <div
        aria-hidden="true"
        className="fixed left-[5%] right-[5%] bottom-0 h-1 pointer-events-none bg-background"
      />
    </>
  );
}
