import { LogOut } from "lucide-react";
import { logoutAction } from "@/app/(routes)/login/actions";

type FooterProps = {
  isAuthenticated: boolean;
};

export function Footer({ isAuthenticated }: FooterProps) {
  return (
    <footer className="mt-auto border-t border-[#23252a] bg-[#010102] px-4 py-6 text-[#8a8f98] md:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        <div className="min-w-0 flex-1" aria-hidden />
        <p className="shrink text-center text-[11px] leading-snug sm:text-[12px]">
          Vibe Coded with Next.js · Supabase © 2026 My Stock
        </p>
        <div className="flex min-w-0 flex-1 justify-end">
          {isAuthenticated ? (
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="로그아웃"
                className="inline-flex items-center gap-1.5 rounded-[8px] border border-transparent px-2 py-1.5 text-[12px] text-[#8a8f98] transition hover:border-[#23252a] hover:bg-[#141516] hover:text-[#d0d6e0]"
              >
                <LogOut size={14} strokeWidth={2} />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </form>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
