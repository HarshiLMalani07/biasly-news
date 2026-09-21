import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

/**
 * The subscribe band above the footer. Presentational only: no form element,
 * no handler and no network call, so nothing is collected until subscriptions
 * exist.
 */
export function NewsletterCta() {
  return (
    <Card className="mt-8 gap-6 p-6 md:flex-row md:items-center md:justify-between">
      <div>
        <h2 className="text-h3 text-text-primary">
          Stay Informed. Stay Balanced.
        </h2>
        <p className="text-body-md mt-1 text-text-secondary">
          Get the top stories and bias analysis delivered to your inbox.
        </p>
      </div>

      <div className="flex w-full gap-3 md:w-auto">
        <Input
          type="email"
          placeholder="Enter your email"
          aria-label="Email address"
          className="md:w-64"
        />
        <Button type="button" variant="primary">
          Subscribe
        </Button>
      </div>
    </Card>
  );
}
