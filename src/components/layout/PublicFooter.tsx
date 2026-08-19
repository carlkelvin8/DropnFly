import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="border-t bg-muted/50">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="grid gap-8 text-sm md:grid-cols-3">
          <div>
            <p className="mb-2 font-bold">Drop<span className="text-blue-600">nfly</span></p>
            <p className="text-muted-foreground">Luggage storage and delivery at NAIA Terminals 1–4.</p>
          </div>
          <div>
            <p className="mb-2 font-semibold text-foreground/80">Quick Links</p>
            <div className="space-y-1">
              <Link href="/book" className="block text-muted-foreground transition-colors hover:text-blue-600">Book a Pickup</Link>
              <Link href="/track" className="block text-muted-foreground transition-colors hover:text-blue-600">Track Luggage</Link>
              <Link href="/my-account/login" className="block text-muted-foreground transition-colors hover:text-blue-600">Login/Register</Link>
            </div>
          </div>
          <div>
            <p className="mb-2 font-semibold text-foreground/80">Support</p>
            <div className="space-y-1">
              <p className="text-muted-foreground">NAIA Terminals 1–4, Pasay City</p>
              <p className="text-muted-foreground">hello@dropnfly.ph</p>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t pt-4 text-center text-xs text-muted-foreground/60">
          &copy; {new Date().getFullYear()} Dropnfly. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
