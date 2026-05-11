import { redirect } from "next/navigation";
import { loginAction } from "@/app/(routes)/login/actions";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

function getErrorMessage(error?: string) {
  if (error === "missing") {
    return "이메일과 비밀번호를 모두 입력해 주세요.";
  }

  if (error === "invalid") {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }

  return null;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const resolvedSearchParams = await searchParams;
  const errorMessage = getErrorMessage(resolvedSearchParams.error);

  if (user) {
    redirect("/stocks");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#010102] px-4 py-10">
      <form
        action={loginAction}
        className="flex w-full max-w-[420px] flex-col gap-5 rounded-[24px] border border-[#23252a] bg-[#0f1011] p-8 text-[#f7f8f8] shadow-[0_0_0_1px_rgba(255,255,255,0.01)]"
      >
        <div className="flex flex-col gap-2">
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-[#8a8f98]">
            My Stock Auth
          </span>
          <h1 className="text-[28px] font-semibold tracking-[-0.03em]">
            로그인
          </h1>
          <p className="text-[14px] leading-6 text-[#d0d6e0]">
            개인 전용 리서치 앱입니다. 등록된 이메일 계정으로만 접근할 수 있습니다.
          </p>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] text-[#d0d6e0]">이메일</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] text-[#d0d6e0]">비밀번호</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            placeholder="비밀번호 입력"
            className="rounded-[8px] border border-[#23252a] bg-[#141516] px-3 py-2.5 text-[14px] text-[#f7f8f8] outline-none transition focus:border-[#5e6ad2] focus:ring-1 focus:ring-[#5e6ad2]"
          />
        </label>

        {errorMessage ? (
          <p className="rounded-[12px] border border-[#3e3e44] bg-[#141516] px-4 py-3 text-[13px] leading-6 text-[#e5484d]">
            {errorMessage}
          </p>
        ) : null}

        <button
          type="submit"
          className="rounded-[8px] bg-[#5e6ad2] px-3 py-2.5 text-[14px] font-medium text-white transition hover:bg-[#828fff]"
        >
          로그인
        </button>
      </form>
    </main>
  );
}
