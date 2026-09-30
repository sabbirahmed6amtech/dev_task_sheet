import { Loader } from "@/components/Loader";

// Shown while the sheet (or any page) loads, including when switching days.
export default function Loading() {
  return <Loader label="Loading the sheet…" />;
}
