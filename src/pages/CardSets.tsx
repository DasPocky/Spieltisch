import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ChevronLeft, Copy, ImagePlus, Layers, Loader2, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import {
  BLANK, cleanSetData, isImage, MAX_ITEMS, MAX_SETS_PER_PROFILE, newSetId, OWN_MIN, SET_KINDS, setImageUrl, SetError,
  type CardSet, type CardSetData, type CardSetInfo, type SetKind, type SetStatus,
} from "@shared/platform/cardsets";
import { isFolge, isZahl, type Frage } from "@shared/games/quiz/fragen/typen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Confirm } from "@/components/Confirm";
import { navigate } from "@/hooks/useRoute";
import { useSiteConfig } from "@/hooks/useSiteConfig";
import { deleteSet, loadSet, mySets, saveSet, submitSet, uploadSetImage } from "@/lib/cardsets";
import { NavRow } from "@/platform/NavRow";
import { Segmented } from "@/platform/Segmented";
import { cn } from "@/lib/utils";
import { remove, RETURN_KEY } from "@/lib/storage";

export const STATUS: Record<SetStatus, { label: string; tone: string; hint: string }> = {
  privat: { label: "Privat", tone: "bg-muted text-muted-foreground", hint: "Nur du kannst es in deinen Räumen wählen." },
  wartet: { label: "Wartet auf Prüfung", tone: "bg-ice/20 text-ice", hint: "Die Verwaltung schaut es sich an. Du kannst es schon selbst nutzen." },
  frei: { label: "Für alle frei", tone: "bg-primary/15 text-primary", hint: "Alle können es in der Lobby wählen. Änderst du es, wird es neu geprüft." },
  abgelehnt: { label: "Abgelehnt", tone: "bg-destructive/15 text-destructive", hint: "Für dich bleibt es nutzbar. Ändere es und schlag es neu vor." },
};
export const kindName = (k: SetKind) => SET_KINDS.find((x) => x.id === k)!.name;
const back = () => navigate("/profil/sets");

export function StatusBadge({ status }: { status: SetStatus }) {
  return <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[0.7rem] font-semibold", STATUS[status].tone)}>{STATUS[status].label}</span>;
}

/** /profil/sets: eigene Kartensets – Liste, „Neues Kartenset“ und je Set der Editor (/profil/sets/<id> bzw. /profil/sets/neu/<art>) */
export function CardSets({ id, kind }: { id?: string; kind?: SetKind }) {
  const config = useSiteConfig();
  if (config && !config.features.profiles) {
    return <main className="mx-auto w-full max-w-xl px-4 pt-6"><p className="text-muted-foreground">Profile sind gerade abgeschaltet – damit auch eigene Kartensets.</p></main>;
  }
  if (id || kind) return <Editor key={id ?? kind} id={id} kind={kind} />;
  return <SetList />;
}

function SetList() {
  const [sets, setSets] = useState<CardSetInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  // Aus der Lobby gekommen („Set anlegen oder bearbeiten“): zurück dorthin
  const [ret] = useState(() => { try { return sessionStorage.getItem(RETURN_KEY); } catch { return null; } });
  useEffect(() => { mySets().then(setSets, (e: Error) => setError(e.message)); }, []);
  const full = (sets?.length ?? 0) >= MAX_SETS_PER_PROFILE;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-3 px-4 pb-4" data-testid="card-sets">
      <header className="-mb-1 flex h-12 shrink-0 items-center">
        {ret
          ? <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => { remove(RETURN_KEY, true); navigate(ret); }}><ChevronLeft />Zurück zur Lobby</Button>
          : <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={() => navigate("/profil")}><ChevronLeft />Profil</Button>}
      </header>
      <h1 className="text-3xl font-bold tracking-tight">Meine Kartensets</h1>
      <p className="text-sm text-muted-foreground">Eigene Karten, Wörter, Begriffe und Fragen für Schamlos, Decknamen, Zeichnen & Raten und das Quiz. Privat, bis du sie für alle vorschlägst.</p>
      <Button size="lg" onClick={() => setAdding(true)} disabled={!sets || full} data-testid="set-new"><Plus />Neues Kartenset</Button>
      {full && <p className="text-center text-xs text-muted-foreground">Höchstens {MAX_SETS_PER_PROFILE} Sets – lösch eins, um ein neues anzulegen.</p>}
      {error && <p role="alert" className="rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p>}
      {!sets && !error && <Loader2 className="mx-auto mt-4 size-5 animate-spin text-muted-foreground" />}
      {sets?.length === 0 && <p className="mt-2 text-center text-sm text-muted-foreground">Noch keine eigenen Sets.</p>}
      <ul className="grid gap-1.5">
        {sets?.map((s) => (
          <li key={s.id}>
            <NavRow icon={Layers} tile title={s.name} sub={`${kindName(s.kind)} · ${s.count}`} onClick={() => navigate(`/profil/sets/${s.id}`)} data-testid="set-row">
              <StatusBadge status={s.status} />
            </NavRow>
          </li>
        ))}
      </ul>
      <Sheet open={adding} onOpenChange={setAdding}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Wofür ist das Set?</SheetTitle>
            <SheetDescription>Die Art lässt sich später nicht mehr ändern.</SheetDescription>
          </SheetHeader>
          <div className="grid gap-1.5 px-5 pt-1 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
            {SET_KINDS.map((k) => <NavRow key={k.id} outline title={k.name} sub={k.hint} onClick={() => navigate(`/profil/sets/neu/${k.id}`)} data-testid={`set-kind-${k.id}`} />)}
          </div>
        </SheetContent>
      </Sheet>
    </main>
  );
}

const lines = (t: string) => t.split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
const textOf = (xs: string[] | undefined) => (xs ?? []).filter((x) => !isImage(x)).join("\n");
const imagesOf = (xs: string[] | undefined) => (xs ?? []).filter(isImage);

/** Editor: Name, Inhalte je Art, Status – Speichern prüft wie der Server und sagt, was rausfällt */
function Editor({ id, kind: newKind }: { id?: string; kind?: SetKind }) {
  const [set, setSet] = useState<CardSet | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [black, setBlack] = useState("");
  const [white, setWhite] = useState("");
  const [words, setWords] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [questions, setQuestions] = useState<Frage[]>([]);
  const [tab, setTab] = useState<"black" | "white">("black");
  const [busy, setBusy] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ i: number | null } | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const fill = (s: Pick<CardSet, "name"> & CardSetData) => {
    setName(s.name); setBlack(textOf(s.black)); setWhite(textOf(s.white)); setWords(textOf(s.words));
    setImages([...imagesOf(s.white), ...imagesOf(s.words)]); setQuestions(s.questions ?? []);
  };
  useEffect(() => {
    if (!id) return;
    loadSet(id).then((s) => { setSet(s); fill(s); }, (e: Error) => setError(e.message));
  }, [id]);

  const kind: SetKind | undefined = set?.kind ?? newKind;
  const status: SetStatus = set?.status ?? "privat";
  const data = useMemo((): CardSetData => {
    if (kind === "schamlos") return { black: lines(black), white: [...lines(white), ...images] };
    if (kind === "quiz") return { questions };
    return { words: [...lines(words), ...(kind === "decknamen" ? images : [])] };
  }, [kind, black, white, words, images, questions]);
  const raw = (data.black?.length ?? 0) + (data.white?.length ?? 0) + (data.words?.length ?? 0) + (data.questions?.length ?? 0);
  const check = useMemo(() => {
    if (!kind) return { error: null, kept: 0 };
    try { const d = cleanSetData(kind, data); return { error: null, kept: (d.black?.length ?? 0) + (d.white?.length ?? 0) + (d.words?.length ?? 0) + (d.questions?.length ?? 0) }; }
    catch (e) { return { error: e instanceof SetError ? e.message : "Das passt so nicht.", kept: 0 }; }
  }, [kind, data]);
  const dirty = !set || JSON.stringify({ name, data }) !== JSON.stringify({ name: set.name, data: kind === "quiz" ? { questions: set.questions } : kind === "schamlos" ? { black: set.black, white: [...lines(textOf(set.white)), ...imagesOf(set.white)] } : { words: [...lines(textOf(set.words)), ...imagesOf(set.words)] } });

  if (error) return <main className="mx-auto w-full max-w-xl px-4 pt-6"><Button variant="ghost" size="sm" className="-ml-2" onClick={back}><ChevronLeft />Meine Kartensets</Button><p role="alert" className="mt-4 rounded-xl bg-destructive/15 p-3 text-sm text-destructive">{error}</p></main>;
  if (!kind || (id && !set)) return <Loader2 className="mx-auto mt-10 size-6 animate-spin text-muted-foreground" />;
  const info = SET_KINDS.find((k) => k.id === kind)!;

  const save = async (): Promise<CardSet | null> => {
    if (check.error) { toast(check.error); return null; }
    setBusy("save");
    try {
      const s = await saveSet(set?.id ?? newSetId(), kind, name, data);
      const dropped = raw - check.kept;
      toast(dropped > 0 ? `Gespeichert – ${dropped} doppelte oder ungültige Einträge weggelassen` : s.status === "wartet" && set?.status === "frei" ? "Gespeichert – wird neu geprüft" : "Gespeichert");
      setSet(s); fill(s);
      if (!set) navigate(`/profil/sets/${s.id}`, true);
      return s;
    } catch (e) { toast((e as Error).message); return null; } finally { setBusy(null); }
  };
  const propose = async (withdraw: boolean) => {
    const s = dirty ? await save() : set;
    if (!s) return;
    setBusy("submit");
    try { const st = await submitSet(s.id, withdraw); setSet({ ...s, status: st, note: undefined }); toast(withdraw ? "Vorschlag zurückgezogen" : "Vorgeschlagen – die Verwaltung schaut es sich an"); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  const duplicate = async () => {
    setBusy("copy");
    try { const s = await saveSet(newSetId(), kind, `${name} (Kopie)`.slice(0, 30), data); toast("Kopie angelegt"); navigate(`/profil/sets/${s.id}`); }
    catch (e) { toast((e as Error).message); } finally { setBusy(null); }
  };
  const remove = async () => {
    if (!set) { back(); return; }
    try { await deleteSet(set.id); toast("Set gelöscht"); back(); } catch (e) { toast((e as Error).message); }
  };
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("image");
    try {
      for (const f of [...files].slice(0, 10)) {
        const v = await uploadSetImage(f);
        setImages((xs) => [...xs, v]);
      }
    } catch (e) { toast((e as Error).message); } finally { setBusy(null); if (file.current) file.current.value = ""; }
  };

  const list = kind === "schamlos" ? (tab === "black" ? black : white) : words;
  const setList = kind === "schamlos" ? (tab === "black" ? setBlack : setWhite) : setWords;
  const withImages = kind === "decknamen" || (kind === "schamlos" && tab === "white");
  const count = (t: string) => lines(t).length;

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col gap-2.5 px-4 pb-3" data-testid="set-editor">
      <header className="-mb-1 flex h-12 shrink-0 items-center justify-between">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" onClick={back}><ChevronLeft />Meine Kartensets</Button>
        <StatusBadge status={status} />
      </header>
      <div className="grid shrink-0 gap-1">
        <Label htmlFor="set-name">{info.name}: Name des Sets</Label>
        <Input id="set-name" value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="z. B. Unsere Insider" />
      </div>
      {set?.note && <p role="status" className="shrink-0 rounded-xl bg-destructive/12 px-3 py-2 text-sm"><b>Hinweis der Verwaltung:</b> {set.note}</p>}

      {kind === "schamlos" && (
        <Segmented ariaLabel="Kartenart" small value={tab} onChange={setTab}
          options={[{ value: "black", label: `Schwarz (${count(black)})` }, { value: "white", label: `Weiß (${count(white) + images.length})` }]} />
      )}

      {kind === "quiz" ? (
        <QuestionList questions={questions} onEdit={(i) => setAsking({ i: i < 0 ? null : i })} onRemove={(i) => setQuestions((qs) => qs.filter((_, k) => k !== i))} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <Label htmlFor="set-lines" className="flex justify-between">
            <span>{kind === "schamlos" ? (tab === "black" ? `Schwarze Karten mit Lücke ${BLANK}` : "Weiße Karten (Antworten)") : info.item} – eine pro Zeile</span>
            <span className="font-normal text-muted-foreground tabular-nums">{count(list)}{withImages && images.length ? ` + ${images.length} ${images.length === 1 ? "Bild" : "Bilder"}` : ""}</span>
          </Label>
          <textarea id="set-lines" value={list} onChange={(e) => setList(e.target.value)} data-testid="set-lines"
            placeholder={kind === "schamlos" ? (tab === "black" ? `Was ist das Geheimnis von ${BLANK}?\nOhne ${BLANK} kein Spieleabend.` : "Omas Kartoffelsalat\nein Stau auf der A3") : kind === "zeichnen" ? "Gartenzwerg\nLeuchtturm" : "Sofa\nPizza"}
            className="min-h-24 flex-1 resize-none rounded-xl border border-input bg-background/60 px-3 py-2 text-base outline-none focus-visible:ring-[3px] focus-visible:ring-ring" />
          {withImages && (
            <div className="flex shrink-0 items-center gap-1.5 overflow-x-auto py-1" aria-label="Bildkarten">
              {images.map((img) => (
                <span key={img} className="relative shrink-0">
                  <img src={setImageUrl(img)} alt="Bildkarte" className="size-14 rounded-lg object-cover ring-1 ring-border" />
                  <button type="button" aria-label="Bild entfernen" onClick={() => setImages((xs) => xs.filter((x) => x !== img))}
                    className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-background ring-1 ring-border"><X className="size-3.5" /></button>
                </span>
              ))}
              <Button variant="secondary" size="sm" className="shrink-0" disabled={busy === "image"} onClick={() => file.current?.click()}>
                {busy === "image" ? <Loader2 className="animate-spin" /> : <ImagePlus />}Bild
              </Button>
              <input ref={file} type="file" accept="image/*" multiple className="hidden" aria-label="Bilder wählen" onChange={(e) => void addImages(e.target.files)} />
            </div>
          )}
        </div>
      )}

      <p className={cn("shrink-0 text-xs", check.error ? "text-destructive" : "text-muted-foreground")} role="status" data-testid="set-check">
        {check.error ?? `${check.kept} von höchstens ${MAX_ITEMS} ${info.item}${raw > check.kept ? ` · ${raw - check.kept} doppelt oder ungültig` : ""}${kind === "decknamen" && check.kept < OWN_MIN.decknamen ? ` · für „Nur eigene Wörter“ ab ${OWN_MIN.decknamen}` : ""}`}
        {!check.error && ` · ${STATUS[status].hint}`}
      </p>

      <div className="grid shrink-0 gap-2">
        <Button size="lg" disabled={!dirty || !!busy || !!check.error} onClick={() => void save()} data-testid="set-save">{busy === "save" && <Loader2 className="animate-spin" />}Speichern</Button>
        <div className="grid grid-cols-3 gap-2">
          {status === "wartet" || status === "frei"
            ? <Button variant="secondary" size="sm" disabled={!!busy} onClick={() => void propose(true)}><Undo2 />Zurückziehen</Button>
            : <Button variant="secondary" size="sm" disabled={!!busy || !!check.error} onClick={() => void propose(false)} data-testid="set-submit"><Send />Vorschlagen</Button>}
          <Button variant="secondary" size="sm" disabled={!set || !!busy} onClick={() => void duplicate()}><Copy />Kopie</Button>
          <Confirm title="Set löschen?" description={status === "frei" ? "Es verschwindet auch aus der Liste für alle." : "Das lässt sich nicht rückgängig machen."} confirmLabel="Löschen" onConfirm={() => void remove()}>
            <Button variant="destructive" size="sm" disabled={!!busy}><Trash2 />Löschen</Button>
          </Confirm>
        </div>
      </div>
      {kind === "quiz" && (
        <QuestionSheet open={!!asking} question={asking?.i != null ? questions[asking.i] : null} onOpenChange={(o) => !o && setAsking(null)}
          onSave={(q) => { setQuestions((qs) => (asking?.i != null ? qs.map((x, k) => (k === asking.i ? q : x)) : [...qs, q])); setAsking(null); }} />
      )}
    </main>
  );
}

const kindLabel = (q: Frage) => (isZahl(q) ? "Schätzen" : isFolge(q) ? "Ordnen" : "Auswahl");
const answerOf = (q: Frage) => (isZahl(q) ? `${q[1]}${q[2] ? ` ${q[2]}` : ""}` : isFolge(q) ? q[1].join(" → ") : q[1]);

function QuestionList({ questions, onEdit, onRemove }: { questions: Frage[]; onEdit: (i: number) => void; onRemove: (i: number) => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center justify-between">
        <span className="text-sm font-semibold">Fragen <span className="font-normal text-muted-foreground">· {questions.length}</span></span>
        <Button size="sm" variant="secondary" onClick={() => onEdit(-1)} data-testid="question-add"><Plus />Frage</Button>
      </div>
      {questions.length === 0
        ? <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">Noch keine Frage. Auswahl (vier Antworten), Schätzen (eine Zahl) oder Ordnen (vier Begriffe).</p>
        : (
          <ul className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto">
            {questions.map((q, i) => (
              <li key={i} className="flex items-center gap-1 rounded-xl ring-1 ring-inset ring-border">
                <button type="button" onClick={() => onEdit(i)} className="min-w-0 flex-1 px-3 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring">
                  <span className="block truncate text-sm font-semibold">{q[0]}</span>
                  <span className="block truncate text-xs text-muted-foreground">{kindLabel(q)} · {answerOf(q)}</span>
                </button>
                <Button variant="ghost" size="icon" aria-label="Frage entfernen" onClick={() => onRemove(i)}><X /></Button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

type QKind = "wahl" | "zahl" | "folge";

/** Eine Frage anlegen oder ändern – je Art die passenden Felder */
function QuestionSheet({ open, question, onOpenChange, onSave }: { open: boolean; question: Frage | null; onOpenChange: (o: boolean) => void; onSave: (q: Frage) => void }) {
  const [k, setK] = useState<QKind>("wahl");
  const [text, setText] = useState("");
  const [four, setFour] = useState(["", "", "", ""]);
  const [num, setNum] = useState("");
  const [unit, setUnit] = useState("");
  useEffect(() => {
    if (!open) return;
    const q = question;
    setK(!q ? "wahl" : isZahl(q) ? "zahl" : isFolge(q) ? "folge" : "wahl");
    setText(q?.[0] ?? "");
    setFour(!q || isZahl(q) ? ["", "", "", ""] : isFolge(q) ? [...q[1]] : [q[1], q[2], q[3], q[4]]);
    setNum(q && isZahl(q) ? String(q[1]) : "");
    setUnit(q && isZahl(q) ? q[2] : "");
  }, [open, question]);
  const n = Number(num.replace(",", "."));
  const q: Frage | null = k === "zahl"
    ? (num.trim() && Number.isFinite(n) ? [text.trim(), n, unit.trim()] : null)
    : k === "folge" ? [text.trim(), four.map((x) => x.trim()) as [string, string, string, string]]
      : [text.trim(), four[0].trim(), four[1].trim(), four[2].trim(), four[3].trim()];
  const valid = useMemo(() => { try { return !!q && cleanSetData("quiz", { questions: [q] }).questions!.length === 1; } catch { return false; } }, [q]);
  const labels = k === "folge" ? ["1. (zuerst)", "2.", "3.", "4. (zuletzt)"] : ["Richtige Antwort", "Falsch", "Falsch", "Falsch"];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{question ? "Frage ändern" : "Neue Frage"}</SheetTitle>
          <SheetDescription>{k === "wahl" ? "Die App mischt die Antworten." : k === "zahl" ? "Wer am nächsten liegt, gewinnt." : "In der richtigen Reihenfolge eingeben – die App mischt."}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-2.5 overflow-y-auto px-5 pt-1 pb-3">
          <Segmented ariaLabel="Art der Frage" small value={k} onChange={setK} options={[{ value: "wahl", label: "Auswahl" }, { value: "zahl", label: "Schätzen" }, { value: "folge", label: "Ordnen" }]} />
          <Input aria-label="Frage" value={text} maxLength={120} onChange={(e) => setText(e.target.value)} placeholder={k === "folge" ? "z. B. vom kleinsten zum größten" : "Frage"} />
          {k === "zahl" ? (
            <div className="grid grid-cols-[1fr_8rem] gap-2">
              <Input aria-label="Richtige Zahl" inputMode="decimal" value={num} onChange={(e) => setNum(e.target.value)} placeholder="Zahl" />
              <Input aria-label="Einheit" value={unit} maxLength={12} onChange={(e) => setUnit(e.target.value)} placeholder="Einheit" />
            </div>
          ) : four.map((v, i) => (
            <Input key={i} aria-label={labels[i]} value={v} maxLength={40} placeholder={labels[i]} className={cn(k === "wahl" && i === 0 && "ring-1 ring-primary")}
              onChange={(e) => setFour((xs) => xs.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          {!valid && text.trim().length >= 3 && <p className="text-xs text-muted-foreground">{k === "zahl" ? "Gib eine Zahl ein." : "Alle vier Felder, jedes anders."}</p>}
        </div>
        <div className="shrink-0 border-t border-border px-5 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button className="w-full" disabled={!valid} onClick={() => q && onSave(cleanSetData("quiz", { questions: [q] }).questions![0])} data-testid="question-save">Übernehmen</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
