"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen, ChevronLeft, CirclePlus, Eye, EyeOff, Home, Leaf,
  LoaderCircle, LocateFixed, Menu, Minus, Plus, Settings, Sparkles,
  Sprout, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

type View = "home" | "diaries" | "editor" | "analysis" | "forest" | "settings";
type Diary = { id: string; title: string; body: string; status: string; localDate: string; createdAt: string };
type Mention = { id: string; diaryId: string; name: string; category: string; confidence: number; evidence: string; status: string; growth: number; createdAt: string };
type Growth = { category: string; appliedGrowth: number };
type AppState = { diaries: Diary[]; mentions: Mention[]; growth: Growth[]; todayGrowth: number };

const categoryLabels: Record<string, string> = {
  LEARNING: "배움", WORK: "일", CREATIVE: "창작", MUSIC: "음악",
  EXERCISE: "운동", SOCIAL: "관계", CULTURE: "문화", DAILY_LIFE: "생활",
  REST: "휴식", TRAVEL: "여행", CARE: "돌봄", OTHER: "그 밖의 활동",
};

const categoryColors: Record<string, string> = {
  LEARNING: "#9ed56b", WORK: "#73a77a", CREATIVE: "#d5b86d", MUSIC: "#a48ad1",
  EXERCISE: "#6fc6a4", SOCIAL: "#df9679", CULTURE: "#77a5c7", DAILY_LIFE: "#b7c97a",
  REST: "#7fa0b9", TRAVEL: "#d19b67", CARE: "#d7869b", OTHER: "#91a78c",
};

const samplePlants = [
  { key: "LEARNING", x: 28, y: 41, growth: 2.4, name: "책 읽기", angle: -154 },
  { key: "MUSIC", x: 53, y: 25, growth: 1.6, name: "기타 연습", angle: -84 },
  { key: "SOCIAL", x: 75, y: 61, growth: 1.2, name: "친구와 식사", angle: 26 },
];

const plantImages = ["/forest/fern.png", "/forest/flowering-vine.png"];

function localDate() {
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function ForainApp({ user, signOutPath }: { user: { name: string; email: string }; signOutPath: string }) {
  const [view, setView] = useState<View>("forest");
  const [state, setState] = useState<AppState>({ diaries: [], mentions: [], growth: [], todayGrowth: 0 });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [activeDiary, setActiveDiary] = useState<Diary | null>(null);
  const [selected, setSelected] = useState<Mention | null>(null);
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
        setView("editor");
        return { view: "editor" };
      },
    }, { signal: controller.signal })).catch(() => undefined);
    return () => controller.abort();
  }, []);

  const mentionsForDiary = useMemo(
    () => state.mentions.filter((mention) => mention.diaryId === activeDiary?.id),
    [state.mentions, activeDiary],
  );

  const plants = useMemo(() => {
    const confirmed = state.mentions.filter((mention) => mention.status === "confirmed");
    if (!confirmed.length) return samplePlants;
    return confirmed.map((mention, index) => {
      const angle = -150 + ((index * 137.5 + mention.name.length * 11) % 300);
      const radius = 23 + ((index * 9 + mention.name.length * 3) % 14);
      const radians = angle * Math.PI / 180;
      return {
        key: mention.category,
        name: mention.name,
        growth: mention.growth || 1,
        x: 50 + Math.cos(radians) * radius,
        y: 53 + Math.sin(radians) * radius * .72,
        angle,
        mention,
      };
    });
  }, [state.mentions]);

  async function saveAndAnalyze() {
    if (!body.trim()) { setError("편린 내용을 입력해 주세요."); return; }
    setBusy(true); setError("");
    try {
      const endpoint = activeDiary ? `/api/diaries/${activeDiary.id}` : "/api/diaries";
      const created = await fetch(endpoint, {
        method: activeDiary ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, localDate: localDate() }),
      });
      if (!created.ok) throw new Error("편린을 저장하지 못했습니다.");
      const { diary } = await created.json();
      setActiveDiary(diary);
      setView("analysis");
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
      setBody(""); setTitle(""); setView("forest");
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

  function startNew() { setTitle(""); setBody(""); setActiveDiary(null); setError(""); setView("editor"); }
  function changeScale(delta: number) { setScale((value) => Math.min(1.8, Math.max(.6, Number((value + delta).toFixed(1))))); }
  function resetCanvas() { setScale(1); setOffset({ x: 0, y: 0 }); }

  const nav = [
    { id: "home" as View, label: "오늘", icon: Home },
    { id: "diaries" as View, label: "편린", icon: BookOpen },
    { id: "forest" as View, label: "결숲", icon: Sprout },
    { id: "settings" as View, label: "설정", icon: Settings },
  ];

  return (
    <main className={`app-shell ${uiHidden ? "ui-hidden" : ""}`}>
      {!uiHidden && (
        <aside className={`side-panel glass ${menuOpen ? "open" : "closed"}`}>
          <div className="brand-row"><div className="brand-seed">F</div>{menuOpen && <strong>Forain</strong>}</div>
          <nav aria-label="주요 메뉴">
            {nav.map((item) => <button key={item.id} className={view === item.id ? "active" : ""} onClick={() => setView(item.id)} title={item.label}><item.icon />{menuOpen && <span>{item.label}</span>}</button>)}
          </nav>
          <button className="new-fragment" onClick={startNew}><CirclePlus />{menuOpen && <span>새 편린</span>}</button>
          <button className="collapse" onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <ChevronLeft /> : <Menu />}{menuOpen && <span>메뉴 접기</span>}</button>
        </aside>
      )}

      <section className="workspace">
        {error && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="오류 닫기"><X /></button></div>}
        {view === "forest" && (
          <section className="forest-view" aria-label="나의 결숲">
            <div
              className="forest-canvas"
              onWheel={(event) => { event.preventDefault(); changeScale(event.deltaY > 0 ? -.1 : .1); }}
              onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); setDrag({ x: event.clientX - offset.x, y: event.clientY - offset.y }); }}
              onPointerMove={(event) => drag && setOffset({ x: event.clientX - drag.x, y: event.clientY - drag.y })}
              onPointerUp={() => setDrag(null)}
            >
              <div className="forest-haze one" /><div className="forest-haze two" />
              <div className="water" /><div className="moss moss-a" /><div className="moss moss-b" />
              <div className="forest-world" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
                <svg className="veins" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                  {plants.map((plant, index) => <path key={index} d={`M 50 53 Q ${(50 + plant.x) / 2 + (index % 2 ? 4 : -4)} ${(53 + plant.y) / 2} ${plant.x} ${plant.y}`} />)}
                </svg>
                <div className="forest-core" aria-label="결숲의 생명 핵">
                  <span className="core-aura" />
                  <img src="/forest/forest-core.png" alt="이끼와 뿌리로 이루어진 둥근 결숲의 생명 핵" draggable={false} />
                  <span className="core-caption">기억의 핵<small>모든 성장은 여기에서 시작돼요</small></span>
                </div>
                {plants.map((plant, index) => {
                  const size = 96 + Math.min(72, plant.growth * 15);
                  const color = categoryColors[plant.key] || categoryColors.OTHER;
                  return (
                    <button
                      key={`${plant.name}-${index}`}
                      className="plant"
                      style={{ left: `${plant.x}%`, top: `${plant.y}%`, width: size, height: size * 1.18, "--plant-color": color, "--lean": `${plant.angle + 90}deg` } as React.CSSProperties}
                      onClick={() => "mention" in plant && setSelected(plant.mention || null)}
                      aria-label={`${plant.name}, 생장도 ${plant.growth.toFixed(1)}`}
                    >
                      <img className="plant-image" src={plantImages[index % plantImages.length]} alt="" draggable={false} />
                      <span className="plant-label"><b>{plant.name}</b><small>생장도 {plant.growth.toFixed(1)}</small></span>
                    </button>
                  );
                })}
              </div>
            </div>
            {!uiHidden && <div className="forest-heading"><p>{new Date().toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</p><h1>{user.name.split("@")[0]}님의 결숲</h1><span>확정된 활동이 쌓일수록 숲의 밀도가 깊어집니다.</span></div>}
            {!uiHidden && <div className="growth-meter glass"><div><span>오늘 반영된 생장도</span><b>{state.todayGrowth.toFixed(1)} / 10.0</b></div><Progress value={state.todayGrowth * 10} /><small>{state.todayGrowth >= 10 ? "오늘의 생장은 충분히 반영되었어요" : "오늘도 결숲이 천천히 자라고 있어요"}</small></div>}
            {!uiHidden && <div className="zoom-controls glass"><Button variant="ghost" size="icon" onClick={() => changeScale(-.1)} aria-label="축소"><Minus /></Button><span>{Math.round(scale * 100)}%</span><Button variant="ghost" size="icon" onClick={() => changeScale(.1)} aria-label="확대"><Plus /></Button><Button variant="ghost" size="icon" onClick={resetCanvas} aria-label="위치 초기화"><LocateFixed /></Button></div>}
            <Button className="hide-ui glass" variant="ghost" size="icon" onClick={() => setUiHidden((value) => !value)} aria-label={uiHidden ? "UI 보이기" : "UI 숨기기"}>{uiHidden ? <Eye /> : <EyeOff />}</Button>
            {!uiHidden && <Button className="floating-write" onClick={startNew}><Sparkles />오늘의 편린 작성</Button>}
          </section>
        )}

        {view === "home" && <Dashboard state={state} onNew={startNew} onForest={() => setView("forest")} />}
        {view === "diaries" && <DiaryList diaries={state.diaries} onOpen={(diary) => { setActiveDiary(diary); setTitle(diary.title); setBody(diary.body); setView("editor"); }} onDelete={removeDiary} onNew={startNew} />}
        {view === "editor" && <Editor title={title} body={body} setTitle={setTitle} setBody={setBody} busy={busy} onBack={() => setView("diaries")} onAnalyze={saveAndAnalyze} />}
        {view === "analysis" && <Analysis diary={activeDiary} mentions={mentionsForDiary} busy={busy} onConfirm={confirmAnalysis} onBack={() => setView("editor")} onUpdate={updateMention} onDelete={removeMention} />}
        {view === "settings" && <SettingsView user={user} signOutPath={signOutPath} />}
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="activity-sheet">
          <SheetHeader><SheetTitle>{selected?.name}</SheetTitle><SheetDescription>{selected ? categoryLabels[selected.category] : ""}에서 자라는 활동</SheetDescription></SheetHeader>
          {selected && <div className="activity-content"><div className="detail-plant"><img src="/forest/fern.png" alt={`${selected.name}을 상징하는 식물`} /></div><dl><div><dt>생장도</dt><dd>{selected.growth.toFixed(1)}</dd></div><div><dt>확신도</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div><div><dt>발견한 문장</dt><dd>{selected.evidence}</dd></div></dl></div>}
        </SheetContent>
      </Sheet>
    </main>
  );
}

function Dashboard({ state, onNew, onForest }: { state: AppState; onNew: () => void; onForest: () => void }) {
  return <div className="content-page"><div className="page-heading"><p className="eyebrow">오늘의 기록</p><h1>천천히 쌓이는 하루</h1><Button onClick={onNew}><CirclePlus />새 편린 작성</Button></div><div className="dashboard-grid"><section className="paper-card"><span className="section-label">최근 편린</span><h2>{state.diaries[0]?.title || "아직 남긴 편린이 없어요"}</h2><p>{state.diaries[0]?.body || "오늘 기억하고 싶은 순간을 편린으로 남겨보세요."}</p></section><section className="stat-card"><Leaf /><span>확정된 활동</span><b>{state.mentions.filter((m) => m.status === "confirmed").length}</b></section><section className="stat-card"><Sprout /><span>오늘의 생장도</span><b>{state.todayGrowth.toFixed(1)}</b></section><section className="forest-callout"><div><span>나의 결숲</span><h2>활동의 흔적을 둘러보세요</h2></div><Button variant="outline" onClick={onForest}>결숲으로 이동</Button></section></div></div>;
}

function DiaryList({ diaries, onOpen, onDelete, onNew }: { diaries: Diary[]; onOpen: (diary: Diary) => void; onDelete: (id: string) => void; onNew: () => void }) {
  return <div className="content-page"><div className="page-heading"><p className="eyebrow">편린 보관함</p><h1>기록한 편린</h1><Button onClick={onNew}><CirclePlus />새 편린</Button></div><div className="diary-list">{diaries.length ? diaries.map((diary) => <article key={diary.id} className="diary-row"><button onClick={() => onOpen(diary)}><time>{diary.localDate}</time><h2>{diary.title || "제목 없는 편린"}</h2><p>{diary.body}</p><span className={`status ${diary.status}`}>{diary.status === "confirmed" ? "결숲에 반영됨" : diary.status === "analyzed" ? "확인 대기" : "저장됨"}</span></button><AlertDialog><AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label="편린 삭제"><Trash2 /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>이 편린을 삭제할까요?</AlertDialogTitle><AlertDialogDescription>연결된 활동과 생장도도 함께 다시 계산됩니다.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => onDelete(diary.id)}>삭제</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></article>) : <div className="empty-state"><BookOpen /><h2>아직 편린이 없어요</h2><p>첫 기록을 남기면 AI가 활동을 채집해 드려요.</p><Button onClick={onNew}>첫 편린 쓰기</Button></div>}</div></div>;
}

function Editor({ title, body, setTitle, setBody, busy, onBack, onAnalyze }: { title: string; body: string; setTitle: (v: string) => void; setBody: (v: string) => void; busy: boolean; onBack: () => void; onAnalyze: () => void }) {
  return <div className="editor-page"><header><Button variant="ghost" onClick={onBack}><ChevronLeft />돌아가기</Button><time>{new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}</time><span>자동 저장 준비됨</span></header><section className="paper-editor"><input aria-label="편린 제목" placeholder="편린 제목 (선택)" value={title} onChange={(e) => setTitle(e.target.value)} /><textarea aria-label="편린 내용" placeholder={"오늘 마음에 남은 일을 자유롭게 적어보세요.\n\n무엇을 했는지, 누구와 함께였는지, 어떤 순간이 기억나는지 편안하게 남겨도 좋아요."} value={body} onChange={(e) => setBody(e.target.value)} maxLength={12000} /><footer><span>{body.length.toLocaleString()}자</span><Button onClick={onAnalyze} disabled={busy || !body.trim()}>{busy ? <LoaderCircle className="spin" /> : <Sparkles />}{busy ? "활동을 채집하는 중" : "저장하고 채집 시작"}</Button></footer></section></div>;
}

function Analysis({ diary, mentions, busy, onConfirm, onBack, onUpdate, onDelete }: { diary: Diary | null; mentions: Mention[]; busy: boolean; onConfirm: () => void; onBack: () => void; onUpdate: (id: string, changes: { name?: string; category?: string }) => void; onDelete: (id: string) => void }) {
  return <div className="analysis-page"><div className="page-heading"><p className="eyebrow">활동 채집 결과</p><h1>편린에서 발견한 활동</h1><p>결숲에 반영하기 전에 잘못 찾은 내용이 없는지 확인해 주세요.</p></div><section className="analysis-layout"><article className="paper-card source"><span className="section-label">원문</span><h2>{diary?.title || "제목 없는 편린"}</h2><p>{diary?.body}</p></article><div className="mention-list">{busy ? <div className="analyzing"><LoaderCircle className="spin" /><h2>편린을 천천히 살펴보고 있어요</h2><p>실제로 한 활동만 골라내고 있습니다.</p></div> : mentions.length ? mentions.map((mention) => <article key={mention.id} className="mention-card"><div className="category-dot" style={{ background: categoryColors[mention.category] }} /><div><select aria-label={`${mention.name} 카테고리`} value={mention.category} onChange={(event) => void onUpdate(mention.id, { category: event.target.value })}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><input aria-label="활동 이름" value={mention.name} onChange={(event) => void onUpdate(mention.id, { name: event.target.value })} /><p>“{mention.evidence}”</p></div><div className="mention-actions"><b>{Math.round(mention.confidence * 100)}%</b><Button variant="ghost" size="icon" onClick={() => void onDelete(mention.id)} aria-label={`${mention.name} 삭제`}><Trash2 /></Button></div></article>) : <div className="analyzing"><Leaf /><h2>확정할 활동을 찾지 못했어요</h2><p>계획이나 다른 사람의 활동이 아니라, 오늘 직접 한 일을 적었는지 확인해 보세요.</p></div>}</div></section><footer className="analysis-actions"><Button variant="outline" onClick={onBack}>편린 수정</Button><Button onClick={onConfirm} disabled={busy || !mentions.length}>{busy ? <LoaderCircle className="spin" /> : <Sprout />}결숲에 반영</Button></footer></div>;
}

function SettingsView({ user, signOutPath }: { user: { name: string; email: string }; signOutPath: string }) {
  return <div className="content-page settings-page"><div className="page-heading"><p className="eyebrow">설정</p><h1>나의 Forain</h1></div><section className="settings-card"><div><span>계정</span><h2>{user.name}</h2><p>{user.email}</p></div><a className="secondary-link" href={signOutPath} target="_top">로그아웃</a></section><section className="settings-card"><div><span>현지 시간대</span><h2>{Intl.DateTimeFormat().resolvedOptions().timeZone}</h2><p>일일 생장도는 현지 날짜 00:00를 기준으로 계산됩니다.</p></div></section><section className="settings-card danger"><div><span>계정 삭제</span><h2>모든 기록과 결숲 삭제</h2><p>MVP에서는 문의 후 처리됩니다. 데이터 구조는 일괄 삭제가 가능하도록 구성되어 있습니다.</p></div></section></div>;
}
