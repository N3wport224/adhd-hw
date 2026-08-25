import { LinkButton } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export default function NotFound() {
  return (
    <EmptyState
      title="That page is not here"
      body="No harm done. Head back to Focus and pick up where you left off."
      action={
        <LinkButton href="/" variant="primary" size="lg">
          Back to Focus
        </LinkButton>
      }
    />
  );
}
