export function FieldError({ pesan }: { pesan?: string }) {
  if (!pesan) return null;
  return <p className="mt-1.5 text-xs font-medium text-destructive">{pesan}</p>;
}
