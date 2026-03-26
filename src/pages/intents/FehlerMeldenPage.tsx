import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TestfallErfassung } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, uploadFile } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { TestfallErfassungDialog } from '@/components/dialogs/TestfallErfassungDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  IconAlertTriangle,
  IconBug,
  IconCircleCheck,
  IconExternalLink,
  IconFileText,
  IconHome,
  IconRefresh,
  IconUpload,
  IconX,
} from '@tabler/icons-react';

const PRIORITY_OPTIONS = LOOKUP_OPTIONS['testfall_erfassung']?.prioritaet ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['testfall_erfassung']?.teststatus ?? [];

const PRIORITY_COLORS: Record<string, string> = {
  niedrig: 'bg-green-100 text-green-700 border-green-200',
  mittel: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  hoch: 'bg-orange-100 text-orange-700 border-orange-200',
  kritisch: 'bg-red-100 text-red-700 border-red-200',
};

const PRIORITY_ACTIVE_COLORS: Record<string, string> = {
  niedrig: 'bg-green-500 text-white border-green-500',
  mittel: 'bg-yellow-500 text-white border-yellow-500',
  hoch: 'bg-orange-500 text-white border-orange-500',
  kritisch: 'bg-red-600 text-white border-red-600',
};

function getPriorityLabel(key: string): string {
  return PRIORITY_OPTIONS.find(o => o.key === key)?.label ?? key;
}

function getStatusLabel(key: string): string {
  return STATUS_OPTIONS.find(o => o.key === key)?.label ?? key;
}

export default function FehlerMeldenPage() {
  const { testfallErfassung, loading, error, fetchAll } = useDashboardData();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [selectedTestfall, setSelectedTestfall] = useState<TestfallErfassung | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  // Step 2 form state
  const [prioritaet, setPrioritaet] = useState<string>('');
  const [testerVorname, setTesterVorname] = useState('');
  const [testerNachname, setTesterNachname] = useState('');
  const [fehlerBeschreibung, setFehlerBeschreibung] = useState('');
  const [anmerkungen, setAnmerkungen] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotUploadedUrl, setScreenshotUploadedUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState('');

  // Step 3 result state
  const [submittedData, setSubmittedData] = useState<{
    testfallName: string;
    prioritaet: string;
    testerVorname: string;
    testerNachname: string;
    fehlerBeschreibung: string;
    screenshotUrl: string | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle deep-linking: ?testfallId=xxx jumps to step 2
  useEffect(() => {
    const testfallId = searchParams.get('testfallId');
    if (testfallId && testfallErfassung.length > 0) {
      const found = testfallErfassung.find(t => t.record_id === testfallId);
      if (found) {
        setSelectedTestfall(found);
        setPrioritaet(found.fields.prioritaet?.key ?? 'mittel');
        setStep(2);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testfallErfassung]);

  // Eligible test cases: not abgeschlossen (all others are eligible for bug reporting)
  const eligibleTestfaelle = testfallErfassung.filter(t => {
    const status = t.fields.teststatus?.key;
    return status !== 'abgeschlossen';
  });

  // Count already failed/blocked
  const failedOrBlockedCount = testfallErfassung.filter(t => {
    const result = t.fields.testergebnis?.key;
    const status = t.fields.teststatus?.key;
    return result === 'fehlgeschlagen' || status === 'blockiert';
  }).length;

  function handleSelectTestfall(id: string) {
    const found = testfallErfassung.find(t => t.record_id === id);
    if (!found) return;
    setSelectedTestfall(found);
    setPrioritaet(found.fields.prioritaet?.key ?? 'mittel');
    setTesterVorname('');
    setTesterNachname('');
    setFehlerBeschreibung('');
    setAnmerkungen('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUploadedUrl(null);
    setValidationError('');
    setStep(2);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setScreenshotFile(file);
    setScreenshotUploadedUrl(null);
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setScreenshotPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    } else {
      setScreenshotPreview(null);
    }
    e.target.value = '';
  }

  function clearScreenshot() {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUploadedUrl(null);
  }

  async function handleSubmitFehler() {
    if (!selectedTestfall) return;

    if (!fehlerBeschreibung.trim() || fehlerBeschreibung.trim().length < 10) {
      setValidationError('Fehlerbeschreibung muss mindestens 10 Zeichen enthalten.');
      return;
    }
    setValidationError('');
    setSaving(true);

    try {
      let finalScreenshotUrl: string | null = screenshotUploadedUrl;

      if (screenshotFile && !screenshotUploadedUrl) {
        try {
          finalScreenshotUrl = await uploadFile(screenshotFile, screenshotFile.name);
          setScreenshotUploadedUrl(finalScreenshotUrl);
        } catch {
          // If upload fails, proceed without screenshot
          finalScreenshotUrl = null;
        }
      }

      await LivingAppsService.updateTestfallErfassungEntry(selectedTestfall.record_id, {
        teststatus: 'blockiert',
        testergebnis: 'fehlgeschlagen',
        prioritaet: prioritaet,
        tester_vorname: testerVorname || undefined,
        tester_nachname: testerNachname || undefined,
        fehler_beschreibung: fehlerBeschreibung,
        screenshot: finalScreenshotUrl ?? selectedTestfall.fields.screenshot ?? undefined,
        anmerkungen: anmerkungen || undefined,
      });

      await fetchAll();

      setSubmittedData({
        testfallName: selectedTestfall.fields.testfall_name ?? '(Kein Name)',
        prioritaet,
        testerVorname,
        testerNachname,
        fehlerBeschreibung,
        screenshotUrl: finalScreenshotUrl,
      });
      setStep(3);
    } finally {
      setSaving(false);
    }
  }

  function resetWizard() {
    setStep(1);
    setSelectedTestfall(null);
    setPrioritaet('');
    setTesterVorname('');
    setTesterNachname('');
    setFehlerBeschreibung('');
    setAnmerkungen('');
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUploadedUrl(null);
    setValidationError('');
    setSubmittedData(null);
  }

  return (
    <IntentWizardShell
      title="Fehler melden"
      subtitle="Fehlgeschlagene oder blockierte Testfaelle eskalieren"
      steps={[
        { label: 'Testfall' },
        { label: 'Dokumentation' },
        { label: 'Bestaetigung' },
      ]}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ============================================================
          STEP 1 — Testfall auswaehlen
      ============================================================ */}
      {step === 1 && (
        <div className="space-y-4">
          {/* Warning banner if there are already failed/blocked cases */}
          {failedOrBlockedCount > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <IconAlertTriangle size={18} className="text-amber-600 shrink-0" />
              <p className="text-sm text-amber-800 font-medium">
                {failedOrBlockedCount} Testfall{failedOrBlockedCount !== 1 ? 'e haben' : ' hat'} bereits Fehler
              </p>
            </div>
          )}

          <div>
            <h2 className="text-base font-semibold text-foreground mb-1">Testfall auswaehlen</h2>
            <p className="text-sm text-muted-foreground">
              Waehle den Testfall aus, fuer den du einen Fehler melden moechtest.
            </p>
          </div>

          <EntitySelectStep
            items={eligibleTestfaelle.map(t => ({
              id: t.record_id,
              title: t.fields.testfall_name ?? '(Kein Name)',
              subtitle: [t.fields.software_version, t.fields.testdatum].filter(Boolean).join(' · '),
              status: t.fields.teststatus
                ? { key: t.fields.teststatus.key, label: t.fields.teststatus.label }
                : undefined,
              stats: t.fields.prioritaet
                ? [{ label: 'Prioritaet', value: t.fields.prioritaet.label }]
                : undefined,
              icon: <IconBug size={20} className="text-destructive" />,
            }))}
            onSelect={handleSelectTestfall}
            searchPlaceholder="Testfall suchen..."
            emptyIcon={<IconBug size={32} />}
            emptyText="Keine offenen Testfaelle gefunden."
            createLabel="Neuen Testfall anlegen"
            onCreateNew={() => setCreateDialogOpen(true)}
            createDialog={
              <TestfallErfassungDialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createTestfallErfassungEntry(fields);
                  await fetchAll();
                  setCreateDialogOpen(false);
                }}
                defaultValues={undefined}
                enablePhotoScan={false}
                enablePhotoLocation={false}
              />
            }
          />
        </div>
      )}

      {/* ============================================================
          STEP 2 — Fehler dokumentieren
      ============================================================ */}
      {step === 2 && selectedTestfall && (
        <div className="space-y-6">
          {/* Read-only test case info card */}
          <div className="rounded-xl border bg-card p-4 space-y-2 overflow-hidden">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="w-9 h-9 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <IconBug size={18} className="text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground truncate">
                  {selectedTestfall.fields.testfall_name ?? '(Kein Name)'}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  {selectedTestfall.fields.software_version && (
                    <span className="text-xs text-muted-foreground">
                      v{selectedTestfall.fields.software_version}
                    </span>
                  )}
                  {selectedTestfall.fields.teststatus && (
                    <StatusBadge
                      statusKey={selectedTestfall.fields.teststatus.key}
                      label={selectedTestfall.fields.teststatus.label}
                    />
                  )}
                  {selectedTestfall.fields.prioritaet && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[selectedTestfall.fields.prioritaet.key] ?? 'bg-muted text-muted-foreground'}`}>
                      {selectedTestfall.fields.prioritaet.label}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main form */}
            <div className="lg:col-span-2 space-y-5">
              {/* Priority escalation */}
              <div className="space-y-2">
                <Label>Prioritaet</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {PRIORITY_OPTIONS.map(opt => {
                    const isActive = prioritaet === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setPrioritaet(opt.key)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all ${
                          isActive
                            ? PRIORITY_ACTIVE_COLORS[opt.key] ?? 'bg-primary text-white border-primary'
                            : PRIORITY_COLORS[opt.key] ?? 'bg-muted text-muted-foreground border-transparent'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tester name */}
              <div className="space-y-2">
                <Label>Tester</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="tester_vorname" className="text-xs text-muted-foreground font-normal">
                      Vorname
                    </Label>
                    <Input
                      id="tester_vorname"
                      value={testerVorname}
                      onChange={e => setTesterVorname(e.target.value)}
                      placeholder="Vorname"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="tester_nachname" className="text-xs text-muted-foreground font-normal">
                      Nachname
                    </Label>
                    <Input
                      id="tester_nachname"
                      value={testerNachname}
                      onChange={e => setTesterNachname(e.target.value)}
                      placeholder="Nachname"
                    />
                  </div>
                </div>
              </div>

              {/* Fehlerbeschreibung — required */}
              <div className="space-y-2">
                <Label htmlFor="fehler_beschreibung">
                  Fehlerbeschreibung <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="fehler_beschreibung"
                  value={fehlerBeschreibung}
                  onChange={e => {
                    setFehlerBeschreibung(e.target.value);
                    if (validationError) setValidationError('');
                  }}
                  placeholder="Beschreibe den Fehler so detailliert wie moeglich..."
                  rows={5}
                  className={validationError ? 'border-destructive focus-visible:ring-destructive' : ''}
                />
                {validationError && (
                  <p className="text-xs text-destructive">{validationError}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {fehlerBeschreibung.trim().length} Zeichen
                  {fehlerBeschreibung.trim().length < 10 && fehlerBeschreibung.trim().length > 0 && (
                    <span className="text-destructive"> (mindestens 10 benoetigt)</span>
                  )}
                </p>
              </div>

              {/* Screenshot */}
              <div className="space-y-2">
                <Label>Screenshot / Anhang (optional)</Label>
                {screenshotFile ? (
                  <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                    {screenshotPreview ? (
                      <img
                        src={screenshotPreview}
                        alt="Vorschau"
                        className="h-14 w-14 rounded-md object-contain border shrink-0 bg-muted"
                      />
                    ) : (
                      <div className="h-14 w-14 rounded-md border bg-muted flex items-center justify-center shrink-0">
                        <IconFileText size={20} className="text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{screenshotFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(screenshotFile.size / 1024).toFixed(0)} KB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={clearScreenshot}
                      className="shrink-0 p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
                      aria-label="Screenshot entfernen"
                    >
                      <IconX size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 p-6 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                    <IconUpload size={22} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground text-center">
                      Screenshot oder PDF hochladen
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                  </label>
                )}
              </div>

              {/* Anmerkungen */}
              <div className="space-y-2">
                <Label htmlFor="anmerkungen">Weitere Anmerkungen</Label>
                <Textarea
                  id="anmerkungen"
                  value={anmerkungen}
                  onChange={e => setAnmerkungen(e.target.value)}
                  placeholder="Optionale Hinweise, Schritte zur Reproduktion, Umgebung, ..."
                  rows={3}
                />
              </div>
            </div>

            {/* Live summary panel */}
            <div className="lg:col-span-1">
              <div className="rounded-xl border bg-destructive/5 border-destructive/20 p-4 space-y-3 sticky top-4">
                <div className="flex items-center gap-2">
                  <IconBug size={16} className="text-destructive shrink-0" />
                  <span className="text-sm font-semibold text-foreground">Fehler-Zusammenfassung</span>
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                      Testfall
                    </p>
                    <p className="text-sm font-medium truncate text-foreground">
                      {selectedTestfall.fields.testfall_name ?? '(Kein Name)'}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                      Prioritaet
                    </p>
                    {prioritaet ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[prioritaet] ?? 'bg-muted text-muted-foreground'}`}>
                        {getPriorityLabel(prioritaet)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Nicht gesetzt</span>
                    )}
                  </div>

                  {(testerVorname || testerNachname) && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                        Tester
                      </p>
                      <p className="text-sm text-foreground">
                        {[testerVorname, testerNachname].filter(Boolean).join(' ')}
                      </p>
                    </div>
                  )}

                  {fehlerBeschreibung.trim() && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                        Fehlerbeschreibung
                      </p>
                      <p className="text-xs text-foreground leading-relaxed line-clamp-4">
                        {fehlerBeschreibung.trim().slice(0, 100)}
                        {fehlerBeschreibung.trim().length > 100 ? '...' : ''}
                      </p>
                    </div>
                  )}

                  {screenshotFile && (
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                        Anhang
                      </p>
                      <p className="text-xs text-foreground truncate">{screenshotFile.name}</p>
                    </div>
                  )}
                </div>

                <div className="pt-1">
                  <div className="flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2">
                    <IconAlertTriangle size={14} className="text-destructive shrink-0" />
                    <p className="text-xs text-destructive font-medium">
                      Status wird auf "Blockiert" gesetzt
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="sm:w-auto"
            >
              Zurueck
            </Button>
            <Button
              onClick={handleSubmitFehler}
              disabled={saving || !fehlerBeschreibung.trim()}
              className="sm:flex-1 bg-destructive hover:bg-destructive/90 text-white"
            >
              {saving ? 'Wird gespeichert...' : 'Fehler melden'}
            </Button>
          </div>
        </div>
      )}

      {/* ============================================================
          STEP 3 — Bestaetigung
      ============================================================ */}
      {step === 3 && submittedData && (
        <div className="space-y-6">
          {/* Success / alert header */}
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center">
              <IconAlertTriangle size={32} stroke={2} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Fehler gemeldet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Der Testfall wurde als blockiert markiert und der Fehler dokumentiert.
              </p>
            </div>
          </div>

          {/* Summary card */}
          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 border-b">
              <h3 className="text-sm font-semibold text-foreground">Zusammenfassung</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                  Testfall
                </p>
                <p className="font-semibold text-foreground">{submittedData.testfallName}</p>
              </div>

              <div className="flex flex-wrap gap-3">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Status
                  </p>
                  <StatusBadge statusKey="blockiert" label={getStatusLabel('blockiert')} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Prioritaet
                  </p>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_COLORS[submittedData.prioritaet] ?? 'bg-muted text-muted-foreground'}`}>
                    {getPriorityLabel(submittedData.prioritaet)}
                  </span>
                </div>
              </div>

              {(submittedData.testerVorname || submittedData.testerNachname) && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                    Tester
                  </p>
                  <p className="text-sm text-foreground">
                    {[submittedData.testerVorname, submittedData.testerNachname].filter(Boolean).join(' ')}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1">
                  Fehlerbeschreibung
                </p>
                <p className="text-sm text-foreground leading-relaxed">
                  {submittedData.fehlerBeschreibung.length > 200
                    ? submittedData.fehlerBeschreibung.slice(0, 200) + '...'
                    : submittedData.fehlerBeschreibung}
                </p>
              </div>

              {submittedData.screenshotUrl && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-2">
                    Screenshot
                  </p>
                  <img
                    src={submittedData.screenshotUrl}
                    alt="Screenshot"
                    className="max-h-24 object-contain rounded-lg border bg-muted"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={resetWizard}
              className="w-full flex items-center justify-center gap-2"
            >
              <IconRefresh size={16} />
              Weiteren Fehler melden
            </Button>
            <Button
              variant="outline"
              asChild
              className="w-full flex items-center justify-center gap-2"
            >
              <a href="#/testfall-erfassung">
                <IconExternalLink size={16} />
                Alle blockierten Testfaelle anzeigen
              </a>
            </Button>
            <Button
              variant="default"
              asChild
              className="w-full flex items-center justify-center gap-2"
            >
              <a href="#/">
                <IconHome size={16} />
                Zur Uebersicht
              </a>
            </Button>
          </div>

          {/* Confirmation icon at bottom */}
          <div className="flex items-center justify-center gap-2 py-2">
            <IconCircleCheck size={16} className="text-green-600" />
            <span className="text-xs text-muted-foreground">Eintrag erfolgreich gespeichert</span>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
