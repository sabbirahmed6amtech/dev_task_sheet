import { Loader } from "@/components/Loader";

// Keeps the admin tabs on screen while the next tab loads.
export default function AdminLoading() {
  return <Loader className="min-h-[60vh]" />;
}
