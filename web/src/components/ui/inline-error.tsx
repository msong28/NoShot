export function InlineError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-medium bg-danger-bg p-three text-sm text-danger">
      {message}
    </p>
  );
}
