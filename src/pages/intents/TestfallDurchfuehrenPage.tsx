import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TestfallErfassung } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, uploadFile } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { TestfallErfassungDialog } from '@/components/dialogs/TestfallErfassungDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  IconClipboardCheck,
  IconCircleCheck,
  IconCircleX,
  IconAlertCircle,
  IconArrowLeft,
  IconRefresh,
  IconHome,
  IconCalendar,
  IconUser,
  IconFileText,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Testfall auswählen' },
  { label: 'Ergebnisse erfassen' },
  { label: 'Abschluss' },
];

const testergebnisOptions = LOOKUP_OPTIONS['testfall_erfassung']?.testergebnis ?? [];
const teststatusOptions = LOOKUP_OPTIONS['testfall_erfassung']?.teststatus ?? [];
const prioritaetOptions = LOOKUP_OPTIONS['testfall_erfassung']?.prioritaet ?? [];

function getTodayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

interface ResultFormState {
  tester_vorname: string;
  tester_nachname: string;
  testdatum: string;
  testergebnis: string;
  fehler_beschreibung: string;
  screenshot: string | null;
  anmerkungen: string;
}

export default function TestfallDurchfuehrenPage() {
  const [searchParams] = useSearchParams();
  const { testfallErfassung, loading, error, fetchAll } = useDashboardData();

  // Wizard step state — initialized from URL
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 3 ? s : 1;
  })();
  const [step, setStep] = useState(initialStep);

  // Selected test case
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('testfallId') ?? null
  );

  // Dialog open state
  const [dialogOpen, setDialogOpen] = useState(false);

  // Saving state
  const [saving, setSaving] = useState(false);

  // Result form state
  const [form, setForm] = useState<ResultFormState>({
    tester_vorname: '',
    tester_nachname: '',
    testdatum: getTodayDate(),
    testergebnis: '',
    fehler_beschreibung: '',
    screenshot: null,
    anmerkungen: '',
  });

  // File input ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenshotUploading, setScreenshotUploading] = useState(false);

  // Completed record snapshot for step 3
  const [completedRecord, setCompletedRecord] = useState<TestfallErfassung | null>(null);

  // If testfallId is in URL and data is loaded, jump to step 2 automatically
  useEffect(() => {
    if (!loading && selectedId && step === 1) {
      const found = testfallErfassung.find(t => t.record_id === selectedId);
      if (found) {
        setStep(2);
      }
    }
  }, [loading, selectedId, testfallErfassung, step]);

  // Filter to open/in_bearbeitung test cases
  const activeTestCases = testfallErfassung.filter(t => {
    const key = t.fields.teststatus?.key;
    return key === 'offen' || key === 'in_bearbeitung';
  });

  const selectedTestfall = testfallErfassung.find(t => t.record_id === selectedId) ?? null;

  async function handleSelectTestfall(id: string) {
    setSelectedId(id);
    // Automatically update status to in_bearbeitung
    const record = testfallErfassung.find(t => t.record_id === id);
    if (record && record.fields.teststatus?.key === 'offen') {
      try {
        await LivingAppsService.updateTestfallErfassungEntry(id, {
          teststatus: 'in_bearbeitung',
        });
        await fetchAll();
      } catch (err) {
        console.error('Fehler beim Aktualisieren des Status:', err);
      }
    }
    setStep(2);
  }

  async function handleScreenshotUpload(file: File) {
    setScreenshotUploading(true);
    try {
      const url = await uploadFile(file, file.name);
      setForm(f => ({ ...f, screenshot: url }));
    } catch (err) {
      console.error('Screenshot-Upload fehlgeschlagen:', err);
    } finally {
      setScreenshotUploading(false);
    }
  }

  async function handleSaveResults() {
    if (!selectedId || !form.testergebnis) return;
    setSaving(true);
    try {
      // Determine final teststatus based on testergebnis
      const finalStatus = form.testergebnis === 'fehlgeschlagen' ? 'blockiert' : 'abgeschlossen';

      const updateFields: Partial<{
        tester_vorname: string;
        tester_nachname: string;
        testdatum: string;
        testergebnis: string;
        fehler_beschreibung: string;
        screenshot: string;
        anmerkungen: string;
        teststatus: string;
      }> = {
        tester_vorname: form.tester_vorname || undefined,
        tester_nachname: form.tester_nachname || undefined,
        testdatum: form.testdatum || undefined,
        testergebnis: form.testergebnis,
        teststatus: finalStatus,
        anmerkungen: form.anmerkungen || undefined,
      };

      if (form.fehler_beschreibung) {
        updateFields.fehler_beschreibung = form.fehler_beschreibung;
      }
      if (form.screenshot) {
        updateFields.screenshot = form.screenshot;
      }

      await LivingAppsService.updateTestfallErfassungEntry(selectedId, updateFields);
      await fetchAll();

      // Capture a snapshot for the completion screen
      const updated = testfallErfassung.find(t => t.record_id === selectedId);
      // Build a synthetic snapshot since fetchAll may not yet reflect changes
      setCompletedRecord({
        record_id: selectedId,
        createdat: updated?.createdat ?? '',
        updatedat: new Date().toISOString(),
        fields: {
          ...updated?.fields,
          tester_vorname: form.tester_vorname || updated?.fields.tester_vorname,
          tester_nachname: form.tester_nachname || updated?.fields.tester_nachname,
          testdatum: form.testdatum || updated?.fields.testdatum,
          testergebnis: testergebnisOptions.find(o => o.key === form.testergebnis),
          teststatus: teststatusOptions.find(o => o.key === finalStatus),
          fehler_beschreibung: form.fehler_beschreibung || updated?.fields.fehler_beschreibung,
          anmerkungen: form.anmerkungen || updated?.fields.anmerkungen,
        },
      });

      setStep(3);
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      alert(err instanceof Error ? err.message : 'Fehler beim Speichern der Ergebnisse');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSelectedId(null);
    setCompletedRecord(null);
    setForm({
      tester_vorname: '',
      tester_nachname: '',
      testdatum: getTodayDate(),
      testergebnis: '',
      fehler_beschreibung: '',
      screenshot: null,
      anmerkungen: '',
    });
    setStep(1);
  }

  const testergebnisColorClass =
    form.testergebnis === 'bestanden'
      ? 'bg-green-50 border-green-200 text-green-700'
      : form.testergebnis === 'fehlgeschlagen'
      ? 'bg-red-50 border-red-200 text-red-700'
      : form.testergebnis === 'nicht_getestet'
      ? 'bg-amber-50 border-amber-200 text-amber-700'
      : 'bg-muted border text-muted-foreground';

  const testergebnisIcon =
    form.testergebnis === 'bestanden' ? (
      <IconCircleCheck size={18} className="text-green-600" stroke={2} />
    ) : form.testergebnis === 'fehlgeschlagen' ? (
      <IconCircleX size={18} className="text-red-600" stroke={2} />
    ) : form.testergebnis === 'nicht_getestet' ? (
      <IconAlertCircle size={18} className="text-amber-600" stroke={2} />
    ) : null;

  const testergebnisLabel =
    testergebnisOptions.find(o => o.key === form.testergebnis)?.label ?? '';

  return (
    <IntentWizardShell
      title="Testfall durchführen"
      subtitle="Testfall auswählen, Ergebnisse erfassen und abschliessen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Select Test Case ── */}
      {step === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={activeTestCases.map(t => ({
              id: t.record_id,
              title: t.fields.testfall_name ?? '(Kein Name)',
              subtitle: [
                t.fields.software_version ? `v${t.fields.software_version}` : null,
                t.fields.testdatum ?? null,
              ]
                .filter(Boolean)
                .join(' · '),
              status: t.fields.teststatus
                ? { key: t.fields.teststatus.key, label: t.fields.teststatus.label }
                : undefined,
              stats: t.fields.prioritaet
                ? [{ label: 'Priorität', value: t.fields.prioritaet.label }]
                : [],
              icon: <IconClipboardCheck size={20} className="text-primary" stroke={1.75} />,
            }))}
            onSelect={handleSelectTestfall}
            searchPlaceholder="Testfall suchen..."
            emptyIcon={<IconClipboardCheck size={40} stroke={1.5} />}
            emptyText="Keine offenen Testfälle gefunden."
            createLabel="Neuen Testfall anlegen"
            onCreateNew={() => setDialogOpen(true)}
            createDialog={
              <TestfallErfassungDialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createTestfallErfassungEntry(fields);
                  await fetchAll();
                }}
                defaultValues={undefined}
                enablePhotoScan={AI_PHOTO_SCAN['TestfallErfassung']}
                enablePhotoLocation={AI_PHOTO_LOCATION['TestfallErfassung']}
              />
            }
          />
          <p className="text-xs text-muted-foreground text-center">
            Es werden nur Testfälle mit Status "Offen" oder "In Bearbeitung" angezeigt.
          </p>
        </div>
      )}

      {/* ── STEP 2: Record Results ── */}
      {step === 2 && selectedTestfall && (
        <div className="space-y-5">
          {/* Summary card */}
          <Card className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <IconClipboardCheck size={20} className="text-primary" stroke={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm truncate">
                      {selectedTestfall.fields.testfall_name ?? '(Kein Name)'}
                    </h3>
                    {selectedTestfall.fields.teststatus && (
                      <StatusBadge
                        statusKey={selectedTestfall.fields.teststatus.key}
                        label={selectedTestfall.fields.teststatus.label}
                      />
                    )}
                    {selectedTestfall.fields.prioritaet && (
                      <StatusBadge
                        statusKey={selectedTestfall.fields.prioritaet.key}
                        label={selectedTestfall.fields.prioritaet.label}
                      />
                    )}
                  </div>
                  {selectedTestfall.fields.testfall_beschreibung && (
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {selectedTestfall.fields.testfall_beschreibung}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {selectedTestfall.fields.software_version && (
                      <span>Version: <span className="text-foreground font-medium">{selectedTestfall.fields.software_version}</span></span>
                    )}
                    {selectedTestfall.fields.testdatum && (
                      <span>Datum: <span className="text-foreground font-medium">{selectedTestfall.fields.testdatum}</span></span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Result form */}
          <div className="space-y-4">
            {/* Tester name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tester_vorname">Vorname Tester</Label>
                <Input
                  id="tester_vorname"
                  placeholder="Vorname"
                  value={form.tester_vorname}
                  onChange={e => setForm(f => ({ ...f, tester_vorname: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tester_nachname">Nachname Tester</Label>
                <Input
                  id="tester_nachname"
                  placeholder="Nachname"
                  value={form.tester_nachname}
                  onChange={e => setForm(f => ({ ...f, tester_nachname: e.target.value }))}
                />
              </div>
            </div>

            {/* Testdatum */}
            <div className="space-y-2">
              <Label htmlFor="testdatum">Testdatum</Label>
              <Input
                id="testdatum"
                type="date"
                value={form.testdatum}
                onChange={e => setForm(f => ({ ...f, testdatum: e.target.value }))}
              />
            </div>

            {/* Testergebnis */}
            <div className="space-y-2">
              <Label>Testergebnis <span className="text-destructive">*</span></Label>
              <div className="flex flex-col sm:flex-row gap-2">
                {testergebnisOptions.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, testergebnis: opt.key }))}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all ${
                      form.testergebnis === opt.key
                        ? opt.key === 'bestanden'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : opt.key === 'fehlgeschlagen'
                          ? 'border-red-500 bg-red-50 text-red-700'
                          : 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-border bg-card text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    {opt.key === 'bestanden' && <IconCircleCheck size={16} stroke={2} />}
                    {opt.key === 'fehlgeschlagen' && <IconCircleX size={16} stroke={2} />}
                    {opt.key === 'nicht_getestet' && <IconAlertCircle size={16} stroke={2} />}
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Live status indicator */}
              {form.testergebnis && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${testergebnisColorClass}`}>
                  {testergebnisIcon}
                  <span>Ergebnis: {testergebnisLabel}</span>
                  {form.testergebnis === 'fehlgeschlagen' && (
                    <span className="ml-auto text-xs opacity-75">Status wird auf "Blockiert" gesetzt</span>
                  )}
                  {form.testergebnis === 'bestanden' && (
                    <span className="ml-auto text-xs opacity-75">Status wird auf "Abgeschlossen" gesetzt</span>
                  )}
                </div>
              )}
            </div>

            {/* Fehlerbeschreibung — only when fehlgeschlagen */}
            {form.testergebnis === 'fehlgeschlagen' && (
              <div className="space-y-2">
                <Label htmlFor="fehler_beschreibung">
                  Fehlerbeschreibung <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="fehler_beschreibung"
                  placeholder="Beschreiben Sie den Fehler so genau wie möglich..."
                  value={form.fehler_beschreibung}
                  onChange={e => setForm(f => ({ ...f, fehler_beschreibung: e.target.value }))}
                  rows={4}
                />
              </div>
            )}

            {/* Screenshot upload */}
            <div className="space-y-2">
              <Label>Screenshot (optional)</Label>
              {form.screenshot ? (
                <div className="flex items-center gap-3 rounded-lg border p-3 bg-card">
                  <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden shrink-0 flex items-center justify-center">
                    <img
                      src={form.screenshot}
                      alt="Screenshot"
                      className="w-full h-full object-cover"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <IconFileText size={20} className="text-muted-foreground absolute" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate text-foreground">{form.screenshot.split('/').pop()}</p>
                    <button
                      type="button"
                      onClick={() => setForm(f => ({ ...f, screenshot: null }))}
                      className="text-xs text-muted-foreground hover:text-destructive mt-0.5"
                    >
                      Entfernen
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) handleScreenshotUpload(file);
                      e.target.value = '';
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={screenshotUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <IconFileText size={16} className="mr-2" stroke={1.75} />
                    {screenshotUploading ? 'Wird hochgeladen...' : 'Screenshot hochladen'}
                  </Button>
                </div>
              )}
            </div>

            {/* Anmerkungen */}
            <div className="space-y-2">
              <Label htmlFor="anmerkungen">Anmerkungen (optional)</Label>
              <Textarea
                id="anmerkungen"
                placeholder="Weitere Anmerkungen zum Test..."
                value={form.anmerkungen}
                onChange={e => setForm(f => ({ ...f, anmerkungen: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="sm:w-auto"
            >
              <IconArrowLeft size={16} className="mr-2" stroke={2} />
              Zurück
            </Button>
            <Button
              onClick={handleSaveResults}
              disabled={saving || !form.testergebnis || (form.testergebnis === 'fehlgeschlagen' && !form.fehler_beschreibung)}
              className="flex-1 sm:flex-none"
            >
              {saving ? (
                'Wird gespeichert...'
              ) : (
                <>
                  <IconCircleCheck size={16} className="mr-2" stroke={2} />
                  Ergebnisse speichern &amp; abschliessen
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Completion ── */}
      {step === 3 && completedRecord && (
        <div className="space-y-6">
          <div className="flex flex-col items-center text-center py-8 gap-4">
            {/* Big icon */}
            <div className={`w-20 h-20 rounded-full flex items-center justify-center ${
              completedRecord.fields.testergebnis?.key === 'bestanden'
                ? 'bg-green-100'
                : completedRecord.fields.testergebnis?.key === 'fehlgeschlagen'
                ? 'bg-red-100'
                : 'bg-amber-100'
            }`}>
              {completedRecord.fields.testergebnis?.key === 'bestanden' ? (
                <IconCircleCheck size={44} className="text-green-600" stroke={1.75} />
              ) : completedRecord.fields.testergebnis?.key === 'fehlgeschlagen' ? (
                <IconCircleX size={44} className="text-red-600" stroke={1.75} />
              ) : (
                <IconAlertCircle size={44} className="text-amber-600" stroke={1.75} />
              )}
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">
                {completedRecord.fields.testergebnis?.key === 'bestanden'
                  ? 'Test bestanden!'
                  : completedRecord.fields.testergebnis?.key === 'fehlgeschlagen'
                  ? 'Test fehlgeschlagen'
                  : 'Test abgeschlossen'}
              </h2>
              <p className="text-sm text-muted-foreground">
                Der Testfall wurde erfolgreich erfasst und abgeschlossen.
              </p>
            </div>
          </div>

          {/* Summary card */}
          <Card className="overflow-hidden">
            <CardContent className="p-5 space-y-4">
              <div className="flex flex-wrap gap-2 items-center">
                <h3 className="font-semibold text-base">
                  {completedRecord.fields.testfall_name ?? '(Kein Name)'}
                </h3>
                {completedRecord.fields.teststatus && (
                  <StatusBadge
                    statusKey={completedRecord.fields.teststatus.key}
                    label={completedRecord.fields.teststatus.label}
                  />
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {/* Testergebnis */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconCircleCheck size={15} stroke={1.75} />
                  <span>Ergebnis:</span>
                  <span className="font-medium text-foreground">
                    {completedRecord.fields.testergebnis?.label ?? '—'}
                  </span>
                </div>

                {/* Tester */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconUser size={15} stroke={1.75} />
                  <span>Tester:</span>
                  <span className="font-medium text-foreground">
                    {[completedRecord.fields.tester_vorname, completedRecord.fields.tester_nachname]
                      .filter(Boolean)
                      .join(' ') || '—'}
                  </span>
                </div>

                {/* Datum */}
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconCalendar size={15} stroke={1.75} />
                  <span>Testdatum:</span>
                  <span className="font-medium text-foreground">
                    {completedRecord.fields.testdatum ?? '—'}
                  </span>
                </div>

                {/* Priorität */}
                {completedRecord.fields.prioritaet && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconClipboardCheck size={15} stroke={1.75} />
                    <span>Priorität:</span>
                    <span className="font-medium text-foreground">
                      {completedRecord.fields.prioritaet.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Error description — only when fehlgeschlagen */}
              {completedRecord.fields.testergebnis?.key === 'fehlgeschlagen' &&
                completedRecord.fields.fehler_beschreibung && (
                <div className="mt-3 p-3 rounded-lg bg-red-50 border border-red-100">
                  <p className="text-xs font-medium text-red-700 mb-1">Fehlerbeschreibung:</p>
                  <p className="text-sm text-red-800 line-clamp-3">
                    {completedRecord.fields.fehler_beschreibung}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1"
            >
              <IconRefresh size={16} className="mr-2" stroke={2} />
              Neuen Testfall durchführen
            </Button>
            <Button
              asChild
              className="flex-1"
            >
              <a href="#/">
                <IconHome size={16} className="mr-2" stroke={2} />
                Zur Übersicht
              </a>
            </Button>
          </div>
        </div>
      )}

      {/* Edge case: step 2 but no selectedTestfall */}
      {step === 2 && !selectedTestfall && (
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground text-sm">Kein Testfall ausgewählt.</p>
          <Button variant="outline" onClick={() => setStep(1)}>
            <IconArrowLeft size={16} className="mr-2" stroke={2} />
            Zurück zur Auswahl
          </Button>
        </div>
      )}
    </IntentWizardShell>
  );
}
