import { Link } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { CloverMark, MoodBean } from "@/components/mood-bean";
import { Button } from "@/components/ui/button";
import { GITHUB_REPO } from "@/lib/themes";

export const Route = createFileRoute("/present")({ component: Present });

function Present() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-5 pb-20 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button variant="ghost" size="sm" className="w-fit px-0" asChild>
          <Link to="/">
            <ArrowLeft /> 놀이터
          </Link>
        </Button>

        <header className="text-center">
          <MoodBean mood="best" size={88} />
          <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground">하루콩 해커톤 · Grok 빌드</p>
          <h1 className="mt-1 text-4xl font-semibold tracking-tight">콩놀이터</h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
            감정 기록 앱이 놀이터가 되면, 하루를 남기는 일이 조금 더 가벼워져요.
          </p>
        </header>

        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold">이 빌드가 말하는 것</h2>
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
            <li>감정은 숙제가 아니라, 콩을 고르는 작은 손맛으로 남겨요.</li>
            <li>게임에서 딴 클로버와 테마가 로비 달력에 다시 입혀져요.</li>
            <li>광고는 방해가 아니라, 테마를 여는 짧은 연출로 두었어요.</li>
          </ul>
        </section>

        <section className="rounded-2xl bg-card p-5 shadow-soft">
          <h2 className="text-sm font-semibold">시연 순서</h2>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-relaxed">
            <li>
              로비에서 오늘 콩을 고르고, 가운데 콩을 눌러 물을 주세요. 클로버가 올라가요.
            </li>
            <li>
              <strong>쑥쑥 콩나무</strong> — 손가락을 좌우로 밀어 잎을 밟고 올라가요. 열매를 따면 광고 뒤 테마가
              열려요.
            </li>
            <li>
              <strong>데굴데굴 콩볼링</strong> — 노란 열쇠 핀을 쓰러뜨리면 다음 스테이지가 열려요. 같은 판도 매번
              조금씩 달라요.
            </li>
            <li>옷장에서 테마를 입히면, 달력의 콩 얼굴이 바뀌어요.</li>
          </ol>
        </section>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild className="h-12">
            <Link to="/climb">콩나무</Link>
          </Button>
          <Button asChild variant="secondary" className="h-12">
            <Link to="/bowl">콩볼링</Link>
          </Button>
        </div>

        <a
          href={GITHUB_REPO}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-medium shadow-soft"
        >
          <CloverMark size={16} />
          GitHub · grok-kong-playground
          <ExternalLink className="size-3.5" />
        </a>
      </main>
    </div>
  );
}
