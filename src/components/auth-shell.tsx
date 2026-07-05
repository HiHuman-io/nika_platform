import Image from "next/image";
import nikaLogo from "../../public/nika.jpg";
import hihumanLogo from "../../public/hihuman.png";

/** Shared auth-page frame (background + centered card), matching the login page. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="relative flex flex-1 items-center justify-center bg-background bg-cover bg-center px-4 py-16"
      style={{ backgroundImage: "url(/ljubljana.jpg)" }}
    >
      <div className="absolute inset-0 bg-black/25" />

      <div className="relative w-full max-w-sm">
        <div className="pointer-events-none absolute -inset-8 rounded-[2.5rem] bg-background/75 blur-2xl" />

        <div className="relative space-y-4 rounded-2xl border border-border bg-surface/90 p-7 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <div className="mb-2 flex flex-col items-center text-center">
            <Image
              src={nikaLogo}
              alt="Nika"
              priority
              className="mb-5 h-auto w-[120px] rounded-md"
            />
            <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-2 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>

          {children}
        </div>

        <div className="mt-8 flex flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted/70">
            Powered by
          </span>
          <Image
            src={hihumanLogo}
            alt="HiHuman"
            className="h-auto w-[90px] opacity-50"
          />
        </div>
      </div>
    </div>
  );
}
