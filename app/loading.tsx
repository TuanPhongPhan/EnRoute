export default function Loading() {
  return (
    <div aria-label="Loading EnRoute" className="animate-pulse rounded-3xl bg-primary-50 p-10">
      <div className="h-4 w-24 rounded bg-primary-100" />
      <div className="mt-5 h-10 max-w-md rounded bg-primary-100" />
      <div className="mt-4 h-5 max-w-lg rounded bg-primary-100" />
    </div>
  );
}
