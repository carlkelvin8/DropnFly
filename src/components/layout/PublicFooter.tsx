import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 text-sm md:grid-cols-3">
          <div>
            <p className="mb-2 font-bold text-blue-600">Dropnfly</p>
            <p className="text-gray-500">Luggage storage and delivery at NAIA Terminals 1–4.</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-gray-700">Quick Links</p>
            <div className="space-y-1">
              <Link href="/book" className="block text-gray-500 transition-colors hover:text-blue-600">Book a Pickup</Link>
              <Link href="/track" className="block text-gray-500 transition-colors hover:text-blue-600">Track Luggage</Link>
              <Link href="/my-account" className="block text-gray-500 transition-colors hover:text-blue-600">My Account</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-gray-700">Support</p>
            <div className="space-y-1">
              <p className="text-gray-500">NAIA Terminals 1–4, Pasay City</p>
              <p className="text-gray-500">support@dropnfly.com</p>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-4 text-center text-xs text-gray-400">
          &copy; {new Date().getFullYear()} Dropnfly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
