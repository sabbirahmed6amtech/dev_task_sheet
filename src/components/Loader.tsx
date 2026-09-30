import Image from "next/image";

/** Full-area loading state: the logo inside a spinning ring in the logo's orange. */
export function Loader({ label = "Loading…", className = "min-h-screen" }: { label?: string; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`grid place-items-center ${className}`}>
      <div className="flex flex-col items-center gap-3">
        <div className="relative size-16">
          <span className="absolute inset-0 animate-spin rounded-full border-[3px] border-brand/15 border-t-brand" />
          <Image src="/logo.png" alt="" width={40} height={40} priority className="absolute inset-3 size-10" />
        </div>
        <span className="text-[12.5px] font-medium text-neutral-500">{label}</span>
      </div>
    </div>
  );
}
