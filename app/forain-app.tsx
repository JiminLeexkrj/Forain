"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, ChevronLeft, CirclePlus, Eye, EyeOff, Leaf,
  LoaderCircle, LocateFixed, Menu, Minus, Plus, Settings, Sparkles,
  Sprout, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type Overlay = "diaries" | "editor" | "analysis" | "settings" | null;
type Diary = { id: string; body: string; status: string; localDate: string; createdAt: string };
type Mention = { id: string; diaryId: string; name: string; category: string; confidence: number; evidence: string; status: string; growth: number; createdAt: string };
type Growth = { category: string; appliedGrowth: number };
type AppState = { diaries: Diary[]; mentions: Mention[]; growth: Growth[]; todayGrowth: number };

const categoryLabels: Record<string, string> = {
  LEARNING: "배움", WORK: "일", CREATIVE: "창작", MUSIC: "음악",
  EXERCISE: "운동", SOCIAL: "관계", CULTURE: "문화", DAILY_LIFE: "생활",
  REST: "휴식", TRAVEL: "여행", CARE: "돌봄", OTHER: "그 밖의 활동",
};

const categoryColors: Record<string, string> = {
  LEARNING: "#63e6ff", WORK: "#ffbd59", CREATIVE: "#ff6fd8", MUSIC: "#aa8cff",
  EXERCISE: "#8df06d", SOCIAL: "#ff8066", CULTURE: "#5c9dff", DAILY_LIFE: "#d7c768",
  REST: "#7184d8", TRAVEL: "#45e0c1", CARE: "#ff82a9", OTHER: "#b8c7bd",
};

const categoryOrder = ["LEARNING", "MUSIC", "CREATIVE", "WORK", "SOCIAL", "CARE", "DAILY_LIFE", "REST", "TRAVEL", "CULTURE", "EXERCISE", "OTHER"];
const categoryPatterns: Record<string, { split: number; rhythm: string }> = {
  LEARNING: { split: 24, rhythm: "결정" }, WORK: { split: 18, rhythm: "격자" },
  CREATIVE: { split: 32, rhythm: "파동" }, MUSIC: { split: 27, rhythm: "박동" },
  EXERCISE: { split: 21, rhythm: "맥박" }, SOCIAL: { split: 36, rhythm: "연결" },
  CULTURE: { split: 30, rhythm: "층위" }, DAILY_LIFE: { split: 16, rhythm: "반복" },
  REST: { split: 40, rhythm: "여백" }, TRAVEL: { split: 34, rhythm: "궤적" },
  CARE: { split: 25, rhythm: "포옹" }, OTHER: { split: 29, rhythm: "변주" },
};

type FractalSegment = { d: string; depth: number; x: number; y: number; angle: number; jitter: number };

// Deterministic PRNG so each category's branch shape stays stable across re-renders
// (hover/state changes) while still reading as hand-grown rather than mirror-symmetric.
function hashSeed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

// Shortest signed rotation from `from` to `to`, in (-180, 180] degrees.
function angleDiff(from: number, to: number) {
  let diff = (to - from) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return diff;
}

function fractalSegments(angle: number, score: number, split: number, seedKey: string) {
  const rand = seededRandom(hashSeed(seedKey));
  const level = score <= 0 ? 0 : Math.min(5, Math.max(1, Math.floor(Math.log2(score + 1)) + 1));
  const radians = angle * Math.PI / 180;
  const startRadius = 66;
  const startX = 500 + Math.cos(radians) * startRadius;
  const startY = 500 + Math.sin(radians) * startRadius;
  const segments: FractalSegment[] = [];
  const grow = (x: number, y: number, direction: number, length: number, depth: number) => {
    const wobble = (rand() - .5) * 16;
    const finalDirection = direction + wobble;
    const rad = finalDirection * Math.PI / 180;
    const reach = length * (.7 + rand() * .6);
    const endX = x + Math.cos(rad) * reach;
    const endY = y + Math.sin(rad) * reach;
    const bend = (rand() > .5 ? 1 : -1) * (3 + rand() * 6 + score * .4);
    const midX = (x + endX) / 2 - Math.sin(rad) * bend;
    const midY = (y + endY) / 2 + Math.cos(rad) * bend;
    segments.push({ d: `M ${x.toFixed(1)} ${y.toFixed(1)} Q ${midX.toFixed(1)} ${midY.toFixed(1)} ${endX.toFixed(1)} ${endY.toFixed(1)}`, depth, x: endX, y: endY, angle: finalDirection, jitter: rand() });
    if (depth >= level) return;
    const nextLength = length * (.55 + Math.min(score, 12) * .004 + rand() * .16);
    const spread = split * (.75 + rand() * .5);
    grow(endX, endY, finalDirection - spread, nextLength, depth + 1);
    grow(endX, endY, finalDirection + spread, nextLength, depth + 1);
    if (depth > 0 && score >= 9 && rand() > .3) grow(endX, endY, finalDirection + (rand() - .5) * 12, nextLength * .8, depth + 1);
    // A few high-growth stems also send a shoot that curves upward (toward -90deg),
    // regardless of the branch's own base direction, so more score keeps reading as
    // more growth instead of saturating the same fixed-direction fractal cone.
    if (depth >= 1 && score >= 6 && rand() > .5) {
      const upBias = Math.min(1, .35 + (score - 6) * .045 + rand() * .25);
      const upDirection = finalDirection + angleDiff(finalDirection, -90) * upBias;
      grow(endX, endY, upDirection, nextLength * (.7 + rand() * .35), depth + 1);
    }
  };
  const trunkLength = (104 + level * 25 + Math.min(score, 12) * 3) * (.85 + rand() * .3);
  grow(startX, startY, angle, trunkLength, 0);
  return { segments, level, startX, startY };
}

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function ForainApp({ user }: { user: { name: string; loginId: string } }) {
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [state, setState] = useState<AppState>({ diaries: [], mentions: [], growth: [], todayGrowth: 0 });
  const [body, setBody] = useState("");
  const [activeDiary, setActiveDiary] = useState<Diary | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(true);
  const [uiHidden, setUiHidden] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const loadState = useCallback(async () => {
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
      if (!response.ok) throw new Error("기록을 불러오지 못했습니다.");
      setState(await response.json());
      setError("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "기록을 불러오지 못했습니다.");
    }
  }, []);

  useEffect(() => { void loadState(); }, [loadState]);

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(context.registerTool({
      name: "start_fragment_creation",
      title: "새 편린 작성",
      description: "Forain에서 새 일기 편린을 작성할 수 있도록 편집기를 엽니다.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => {
        if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).length) {
          throw new Error("입력은 빈 객체여야 합니다.");
        }
        setOverlay("editor");
        return { view: "editor" };
      },
    }, { signal: controller.signal })).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const mentionsForDiary = useMemo(
    () => state.mentions.filter((mention) => mention.diaryId === activeDiary?.id),
    [state.mentions, activeDiary],
  );

  const categoryGrowth = useMemo(() => Object.fromEntries(categoryOrder.map((category) => [
    category,
    Number(state.growth.find((item) => item.category === category)?.appliedGrowth || 0),
  ])), [state.growth]);

  async function saveAndAnalyze() {
    if (!body.trim()) { setError("편린 내용을 입력해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const created = await fetch("/api/diaries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body, localDate: localDate() }),
      });
      if (!created.ok) throw new Error("편린을 저장하지 못했습니다.");
      const { diary } = await created.json() as { diary: Diary };
      setActiveDiary(diary);
      setOverlay("analysis");
      const analyzed = await fetch(`/api/diaries/${diary.id}/analyze`, { method: "POST" });
      if (!analyzed.ok) throw new Error("활동을 채집하지 못했습니다. 편린은 안전하게 저장되었습니다.");
      await loadState();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "저장 중 오류가 발생했습니다.");
    } finally { setBusy(false); }
  }

  async function confirmAnalysis() {
    if (!activeDiary) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/diaries/${activeDiary.id}/analysis/confirm`, { method: "POST" });
      if (!response.ok) throw new Error("활동을 결숲에 반영하지 못했습니다.");
      await loadState();
      setBody(""); setActiveDiary(null); setOverlay(null);
    } catch (confirmError) {
      setError(confirmError instanceof Error ? confirmError.message : "반영 중 오류가 발생했습니다.");
    } finally { setBusy(false); }
  }

  async function removeDiary(id: string) {
    const response = await fetch(`/api/diaries/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("편린을 삭제하지 못했습니다."); return; }
    await loadState();
  }

  async function updateMention(id: string, changes: { name?: string; category?: string }) {
    const response = await fetch(`/api/activity-mentions/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes),
    });
    if (!response.ok) { setError("활동을 수정하지 못했습니다."); return; }
    await loadState();
  }

  async function removeMention(id: string) {
    const response = await fetch(`/api/activity-mentions/${id}`, { method: "DELETE" });
    if (!response.ok) { setError("활동을 삭제하지 못했습니다."); return; }
    await loadState();
  }

  function startNew() { setBody(""); setActiveDiary(null); setError(""); setOverlay("editor"); }
  function changeScale(delta: number) { setScale((value) => Math.min(1.8, Math.max(.6, Number((value + delta).toFixed(1))))); }
  function resetCanvas() { setScale(1); setOffset({ x: 0, y: 0 }); }

  return (
    <main className={`app-shell ${uiHidden ? "ui-hidden" : ""}`}>
      {!uiHidden && (
        <aside className={`side-panel glass ${menuOpen ? "open" : "closed"}`}>
          <div className="brand-row"><div className="brand-seed">F</div>{menuOpen && <strong>Forain</strong>}</div>
          <nav aria-label="주요 메뉴">
            <button className="active" title="결숲"><Sprout />{menuOpen && <span>결숲</span>}</button>
            <button onClick={() => setOverlay("diaries")} title="편린"><BookOpen />{menuOpen && <span>편린</span>}</button>
            <button onClick={() => setOverlay("settings")} title="설정"><Settings />{menuOpen && <span>설정</span>}</button>
          </nav>
          <button className="new-fragment" onClick={startNew}><CirclePlus />{menuOpen && <span>새 편린</span>}</button>
          <button className="collapse" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <ChevronLeft /> : <Menu />}{menuOpen && <span>메뉴 접기</span>}</button>
        </aside>
      )}

      <section className="workspace">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="오류 닫기"><X /></button></div>}
        <section className="forest-view" aria-label="나의 결숲">
            <div
              className="forest-canvas"
              onWheel={(event) => { event.preventDefault(); changeScale(event.deltaY > 0 ? -.1 : .1); }}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX - offset.x, y: event.clientY - offset.y }); }}
              onPointerMove={(event) => drag && setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y })}
              onPointerUp={() => setDrag(null)}
            >
              <div className="forest-world" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
                <FractalCanopy growth={categoryGrowth} selected={selectedCategory} onSelect={setSelectedCategory} />
              </div>
            </div>
            {!uiHidden && <div className="forest-heading"><p>{new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</p><h1>{user.name.split("@")[0]}님의 결숲</h1><span>열두 줄기는 활동의 결을 따라 서로 다른 방식으로 자랍니다.</span></div>}
            {!uiHidden && <div className="growth-meter glass"><div><span>오늘 반영된 생장도</span><b>{state.todayGrowth.toFixed(1)}</b></div><small>기록한 활동만큼 제한 없이 자라고 있어요</small></div>}
            {!uiHidden && <div className="zoom-controls glass"><Button variant="ghost" size="icon" onClick={() => changeScale(-.1)} aria-label="축소"><Minus /></Button><span>{Math.round(scale * 100)}%</span><Button variant="ghost" size="icon" onClick={() => changeScale(.1)} aria-label="확대"><Plus /></Button><Button variant="ghost" size="icon" onClick={resetCanvas} aria-label="위치 초기화"><LocateFixed /></Button></div>}
            <Button className="hide-ui glass" variant="ghost" size="icon" onClick={() => setUiHidden((value) => !value)} aria-label={uiHidden ? "UI 보이기" : "UI 숨기기"}>{uiHidden ? <Eye /> : <EyeOff />}</Button>
            {!uiHidden && <Button className="floating-write" onClick={startNew}><Sparkles />오늘의 편린 작성</Button>}
          </section>
      </section>

      <Dialog open={Boolean(overlay)} onOpenChange={(open) => { if (!open && !busy) setOverlay(null); }}>
        <DialogContent className={`forest-overlay ${overlay === "editor" ? "writing-overlay" : ""} ${overlay === "analysis" ? "analysis-overlay" : ""}`}>
          {overlay === "editor" && <Editor body={body} setBody={setBody} busy={busy} onAnalyze={saveAndAnalyze} />}
          {overlay === "analysis" && <Analysis diary={activeDiary} mentions={mentionsForDiary} busy={busy} onConfirm={confirmAnalysis} onUpdate={updateMention} onDelete={removeMention} />}
          {overlay === "diaries" && <DiaryList diaries={state.diaries} onDelete={removeDiary} onNew={startNew} onReview={(diary) => { setActiveDiary(diary); setOverlay("analysis"); }} />}
          {overlay === "settings" && <SettingsView user={user} />}
        </DialogContent>
      </Dialog>

      <Sheet open={Boolean(selectedCategory)} onOpenChange={(open) => !open && setSelectedCategory(null)}>
        <SheetContent className="activity-sheet">
          <SheetHeader><SheetTitle>{selectedCategory ? categoryLabels[selectedCategory] : ""}</SheetTitle><SheetDescription>이 줄기는 해당 카테고리의 누적 활동으로 자랍니다.</SheetDescription></SheetHeader>
          {selectedCategory && <div className="category-detail"><div className="detail-orbit" style={{ "--category-color": categoryColors[selectedCategory] } as React.CSSProperties}><span /><i /><b /></div><dl><div><dt>누적 생장도</dt><dd>{categoryGrowth[selectedCategory].toFixed(1)}</dd></div><div><dt>고유 패턴</dt><dd>{categoryPatterns[selectedCategory].rhythm}</dd></div><div><dt>현재 단계</dt><dd>{fractalSegments(0, categoryGrowth[selectedCategory], categoryPatterns[selectedCategory].split, selectedCategory).level + 1}단계</dd></div></dl></div>}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function FractalCanopy({ growth, selected, onSelect }: { growth: Record<string, number>; selected: string | null; onSelect: (category: string) => void }) {
  const [hovered, setHovered] = useState<{ category: string; x: number; y: number } | null>(null);

  const moveTooltip = (event: React.PointerEvent<SVGGElement>, category: string) => {
    const svg = event.currentTarget.ownerSVGElement;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const local = point.matrixTransform(matrix.inverse());
    setHovered({ category, x: local.x, y: local.y });
  };

  return <svg className="fractal-canopy" viewBox="0 0 1000 1000" role="img" aria-label="중앙 핵에서 열두 카테고리의 줄기가 프랙탈 구조로 자라는 결숲" onPointerLeave={() => setHovered(null)}>
    <defs>
      {categoryOrder.map((category) => <filter key={category} id={`glow-${category.toLowerCase()}`} x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>)}
    </defs>
    <circle className="fractal-field-ring outer" cx="500" cy="500" r="392" />
    <circle className="fractal-field-ring middle" cx="500" cy="500" r="286" />
    <circle className="fractal-field-ring inner" cx="500" cy="500" r="176" />
    {categoryOrder.map((category, index) => {
      const score = growth[category] || 0;
      if (score <= 0) return null;
      const angle = -90 + index * 30;
      const color = categoryColors[category];
      const pattern = categoryPatterns[category];
      const branch = fractalSegments(angle, score, pattern.split, category);
      const thickness = 2.4 + Math.min(score, 20) * .13;
      const active = !selected || selected === category;
      return <g key={category} className={`fractal-branch ${active ? "is-active" : "is-muted"}`} style={{ "--branch-color": color, "--branch-strength": Math.min(1, .25 + score / 12) } as React.CSSProperties} role="button" tabIndex={0} aria-label={`${categoryLabels[category]} 줄기, 누적 생장도 ${score.toFixed(1)}`} onPointerEnter={(event) => moveTooltip(event, category)} onPointerMove={(event) => moveTooltip(event, category)} onPointerLeave={() => setHovered(null)} onClick={() => onSelect(category)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(category); } }}>
        <path className="fractal-hit" d={`M 500 500 L ${branch.startX.toFixed(1)} ${branch.startY.toFixed(1)}`} />
        <path className="fractal-spoke halo" d={`M 500 500 L ${branch.startX.toFixed(1)} ${branch.startY.toFixed(1)}`} stroke={color} strokeWidth={thickness + 8} />
        <path className="fractal-spoke" d={`M 500 500 L ${branch.startX.toFixed(1)} ${branch.startY.toFixed(1)}`} stroke={color} strokeWidth={thickness + 1.5} />
        {branch.segments.map((segment, segmentIndex) => <g key={segmentIndex}>
          <path className="fractal-hit" d={segment.d} />
          <path className="fractal-segment halo" d={segment.d} stroke={color} strokeWidth={Math.max(.9, thickness * (1 - segment.depth * .2)) + 7} />
          <path className="fractal-segment" d={segment.d} stroke={color} strokeWidth={Math.max(.9, thickness * (1 - segment.depth * .2))} filter={score > 3 ? `url(#glow-${category.toLowerCase()})` : undefined} />
          {segment.depth === branch.level && score > 0 && <Foliage x={segment.x} y={segment.y} angle={segment.angle} jitter={segment.jitter} score={score} color={color} />}
        </g>)}
        <Fireflies segments={branch.segments} score={score} />
      </g>;
    })}
    <g className="nucleus-tangle" aria-hidden="true">
      <path d="M 456 489 C 468 457 518 451 541 477 C 559 498 538 533 506 542 C 474 551 448 526 456 489" />
      <path d="M 462 516 C 471 480 520 465 542 493 C 557 513 526 543 493 537 C 461 532 449 503 468 477" />
      <path d="M 471 465 C 500 478 532 472 548 501 C 531 516 509 531 479 526 C 451 521 452 487 471 465" />
      <path d="M 447 501 C 468 489 480 452 510 458 C 539 464 552 491 538 520 C 523 550 477 546 459 525" />
      <path d="M 483 451 C 472 480 474 516 504 544 C 523 529 546 507 539 478 C 513 468 489 476 463 502" />
      <path d="M 451 511 C 475 519 507 505 527 471 C 548 484 552 515 526 535 C 500 554 467 535 462 503" />
      <path d="M 464 476 C 489 489 516 492 547 480 C 539 512 515 536 484 539 C 466 520 456 498 464 476" />
      <path d="M 474 542 C 481 518 495 491 529 462 C 548 480 546 508 529 529 C 504 538 480 526 452 493" />
      <path d="M 451 487 C 477 469 505 469 543 510 C 525 526 495 543 469 530 C 455 511 458 493 478 458" />
      <path d="M 459 522 C 487 505 519 507 546 490 C 538 472 513 455 488 459 C 473 482 467 511 493 543" />
      <path d="M 475 468 C 493 496 515 521 542 524 C 548 498 532 474 505 458 C 483 467 463 487 455 514" />
      <path d="M 452 498 C 479 535 518 548 542 507 C 529 481 502 467 474 475 C 457 490 459 513 478 535" />
    </g>
    {hovered && <g className="branch-cursor-label" transform={`translate(${Math.min(860, hovered.x + 18)} ${Math.min(935, hovered.y + 20)})`} pointerEvents="none">
      <rect x="0" y="-28" width={categoryLabels[hovered.category].length > 4 ? 112 : 82} height="38" rx="12" />
      <circle cx="15" cy="-9" r="4" fill={categoryColors[hovered.category]} />
      <text x="27" y="-5">{categoryLabels[hovered.category]}</text>
    </g>}
  </svg>;
}

function Foliage({ x, y, angle, jitter, score, color }: { x: number; y: number; angle: number; jitter: number; score: number; color: string }) {
  const base = 2.6 + Math.min(score, 10) * .34;
  const leafCount = score >= 5 ? 3 : score >= 2 ? 2 : 1;
  return <g className="fractal-foliage">
    {Array.from({ length: leafCount }, (_, index) => {
      const spread = (index - (leafCount - 1) / 2) * (16 + jitter * 10);
      const variance = (jitter * 37 + index * 53) % 1;
      const size = base * (.78 + variance * .5);
      const leafAngle = angle + spread;
      const rad = leafAngle * Math.PI / 180;
      const cx = x + Math.cos(rad) * size * 1.05;
      const cy = y + Math.sin(rad) * size * 1.05;
      return <ellipse key={index} className="fractal-bud" cx={cx} cy={cy} rx={size * 1.9} ry={size * .95} fill={color} transform={`rotate(${leafAngle.toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})`} />;
    })}
  </g>;
}

function Fireflies({ segments, score }: { segments: FractalSegment[]; score: number }) {
  const count = Math.min(6, Math.floor(score / 3));
  if (count <= 0 || !segments.length) return null;
  return <g className="fractal-fireflies" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => {
      const segment = segments[Math.floor(((index + .5) / count) * segments.length) % segments.length];
      const radius = 6 + segment.jitter * 8;
      const duration = (4.8 + segment.jitter * 4.2).toFixed(2);
      const delay = (segment.jitter * Number(duration)).toFixed(2);
      const twinkleDelay = (segment.jitter * 2.4).toFixed(2);
      const style = {
        "--fx-cx": `${segment.x.toFixed(1)}px`,
        "--fx-cy": `${segment.y.toFixed(1)}px`,
        "--fx-r": `${radius.toFixed(1)}px`,
        "--fx-duration": `${duration}s`,
        "--fx-delay": `${delay}s`,
        "--fx-direction": index % 2 ? "reverse" : "normal",
        "--fx-twinkle-delay": `${twinkleDelay}s`,
      } as React.CSSProperties;
      return <g key={index} className="firefly" style={style}>
        <circle className="firefly-halo" cx={segment.x} cy={segment.y} r={7 + segment.jitter * 4} />
        <circle className="firefly-core" cx={segment.x} cy={segment.y} r={3 + segment.jitter * 1.8} />
      </g>;
    })}
  </g>;
}

function DiaryList({ diaries, onDelete, onNew, onReview }: { diaries: Diary[]; onDelete: (id: string) => void; onNew: () => void; onReview: (diary: Diary) => void }) {
  return <div className="overlay-page diary-overlay-page"><DialogHeader><p className="eyebrow">편린 보관함</p><DialogTitle>기록한 편린</DialogTitle><DialogDescription>한 번 남긴 편린은 수정되지 않고 그날의 모습으로 보관됩니다.</DialogDescription></DialogHeader><Button className="overlay-primary-action" onClick={onNew}><CirclePlus />새 편린</Button><div className="diary-list">{diaries.length ? diaries.map((diary) => <article key={diary.id} className="diary-row"><div className="diary-readonly"><time>{diary.localDate}</time><p>{diary.body}</p><div className="diary-state-row"><span className={`status ${diary.status}`}>{diary.status === "confirmed" ? "결숲에 반영됨" : diary.status === "analyzed" ? "활동 확인 대기" : "저장됨"}</span>{diary.status === "analyzed" && <Button size="sm" variant="outline" onClick={() => onReview(diary)}>활동 확인</Button>}</div></div><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="편린 삭제"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>이 편린을 삭제할까요?</AlertDialogTitle><AlertDialogDescription>연결된 활동과 생장도도 함께 다시 계산됩니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onDelete(diary.id)}>삭제</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></article>) : <div className="empty-state"><BookOpen /><h2>아직 편린이 없어요</h2><p>첫 기록을 남기면 결숲이 자라기 시작해요.</p><Button onClick={onNew}>첫 편린 쓰기</Button></div>}</div></div>;
}

function Editor({ body, setBody, busy, onAnalyze }: { body: string; setBody: (v: string) => void; busy: boolean; onAnalyze: () => void }) {
  return <div className="popup-editor"><DialogHeader><p className="eyebrow">오늘의 편린</p><DialogTitle>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</DialogTitle><DialogDescription>저장한 뒤에는 내용을 수정할 수 없어요.</DialogDescription></DialogHeader><section className="paper-editor"><textarea autoFocus aria-label="편린 내용" placeholder={"오늘 마음에 남은 일을 자유롭게 적어보세요.\n\n무엇을 했는지, 누구와 함께였는지, 어떤 순간이 기억나는지 편안하게 남겨도 좋아요."} value={body} onChange={(e) => setBody(e.target.value)} maxLength={12000} /><footer><span>{body.length.toLocaleString()}자</span><Button onClick={onAnalyze} disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />}{busy ? "활동을 채집하는 중" : "편린 남기기"}</Button></footer></section></div>;
}

function Analysis({ diary, mentions, busy, onConfirm, onUpdate, onDelete }: { diary: Diary | null; mentions: Mention[]; busy: boolean; onConfirm: () => void; onUpdate: (id: string, changes: { name?: string; category?: string }) => void; onDelete: (id: string) => void }) {
  return <div className="overlay-page"><DialogHeader><p className="eyebrow">활동 채집 결과</p><DialogTitle>편린에서 발견한 활동</DialogTitle><DialogDescription>편린 원문은 보존되며, 결숲에 반영할 활동만 확인할 수 있어요.</DialogDescription></DialogHeader><section className="analysis-layout"><article className="paper-card source"><span className="section-label">남긴 편린</span><p>{diary?.body}</p></article><div className="mention-list">{busy ? <div className="analyzing"><LoaderCircle className="spin" /><h2>편린을 천천히 살펴보고 있어요</h2><p>실제로 한 활동만 골라내고 있습니다.</p></div> : mentions.length ? mentions.map((mention) => <article key={mention.id} className="mention-card"><div className="category-dot" style={{ background: categoryColors[mention.category] }} /><div><select aria-label={`${mention.name} 카테고리`} value={mention.category} onChange={(event) => void onUpdate(mention.id, { category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="활동 이름" value={mention.name} onChange={(event) => void onUpdate(mention.id, { name: event.target.value })} /><p>“{mention.evidence}”</p></div><div className="mention-actions"><b>{Math.round(mention.confidence * 100)}%</b><Button variant="ghost" size="icon" onClick={() => void onDelete(mention.id)} aria-label={`${mention.name} 삭제`}><Trash2 /></Button></div></article>) : <div className="analyzing"><Leaf /><h2>확정할 활동을 찾지 못했어요</h2><p>오늘 직접 한 일을 적었는지 확인해 보세요.</p></div>}</div></section><footer className="analysis-actions"><Button onClick={onConfirm} disabled={busy || !mentions.length}>{busy ? <LoaderCircle className="spin" /> : <Sprout />}결숲에 반영</Button></footer></div>;
}

function SettingsView({ user }: { user: { name: string; loginId: string } }) {
  async function signOut() { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/"; }
  return <div className="overlay-page settings-overlay-page"><DialogHeader><p className="eyebrow">설정</p><DialogTitle>나의 Forain</DialogTitle><DialogDescription>결숲을 떠나지 않고 계정 정보를 확인합니다.</DialogDescription></DialogHeader><section className="settings-card"><div><span>계정</span><h2>{user.name}</h2><p>@{user.loginId}</p></div><Button variant="outline" onClick={() => void signOut()}>로그아웃</Button></section><section className="settings-card"><div><span>현지 시간대</span><h2>{Intl.DateTimeFormat().resolvedOptions().timeZone}</h2><p>날짜는 현지 시간대를 기준으로 기록됩니다.</p></div></section><section className="settings-card danger"><div><span>계정 삭제</span><h2>모든 기록과 결숲 삭제</h2><p>MVP에서는 문의 후 처리됩니다.</p></div></section></div>;
}
