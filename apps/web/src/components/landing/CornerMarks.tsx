// Decorative blueprint-style corner brackets
export function CornerMarks({ color = "border-blue/40" }: { color?: string }) {
  const base = `absolute h-2 w-2 ${color}`;
  return (
    <>
      <span className={`${base} left-0 top-0 border-l border-t`} />
      <span className={`${base} right-0 top-0 border-r border-t`} />
      <span className={`${base} bottom-0 left-0 border-b border-l`} />
      <span className={`${base} bottom-0 right-0 border-b border-r`} />
    </>
  );
}
