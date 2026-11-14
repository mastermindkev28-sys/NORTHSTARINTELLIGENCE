import Link from "next/link";
export default function NotFound() {
  return (
    <div className="py-24 text-center">
      <div className="num text-signal">404</div>
      <h1 className="mt-2 text-xl text-arctic">Not found</h1>
      <Link href="/" className="mt-4 inline-block text-sm text-signal hover:underline">Return to overview</Link>
    </div>
  );
}
