import { ErrorScreen } from "@/components/error/ErrorScreen";

// Shown when a page calls notFound(): an unknown or removed portfolio link.
export default function NotFound() {
  return <ErrorScreen mood="lost" />;
}
