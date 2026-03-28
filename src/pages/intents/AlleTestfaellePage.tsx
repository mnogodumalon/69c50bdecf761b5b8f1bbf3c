import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { TestfallErfassung } from '@/types/app';
import { LOOKUP_OPTIONS, APP_IDS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate } from '@/lib/formatters';
import { executeAction, downloadFile, fetchActionsAndFiles } from '@/lib/actions-agent';
import { TestfallErfassungDialog } from '@/components/dialogs/TestfallErfassungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  IconArrowLeft, IconPlus, IconPencil, IconTrash, IconSearch,
  IconAlertCircle, IconClipboardList, IconCalendar, IconUser, IconTag,
  IconFileExport, IconLoader2,
} from '@tabler/icons-react';

const PRIORITY_COLORS: Record<string, string> = {
  niedrig: 'bg-slate-100 text-slate-600 border-slate-200',
  mittel: 'bg-blue-100 text-blue-700 border-blue-200',
  hoch: 'bg-orange-100 text-orange-700 border-orange-200',
  kritisch: 'bg-red-100 text-red-700 border-red-200',
};

const ERGEBNIS_COLORS: Record<string, string> = {
  bestanden: 'bg-green-100 text-green-700 border-green-200',
  fehlgeschlagen: 'bg-red-100 text-red-700 border-red-200',
  nicht_getestet: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_COLORS: Record<string, string> = {
  offen: 'bg-blue-100 text-blue-700 border-blue-200',
  in_bearbeitung: 'bg-amber-100 text-amber-700 border-amber-200',
  abgeschlossen: 'bg-green-100 text-green-700 border-green-200',
  blockiert: 'bg-red-100 text-red-700 border-red-200',
};

const STATUS_BAR: Record<string, string> = {
  offen: 'bg-blue-400',
  in_bearbeitung: 'bg-amber-400',
  abgeschlossen: 'bg-green-500',
  blockiert: 'bg-red-500',
};

export default function AlleTestfaellePage() {
  const { testfallErfassung, loading, error, fetchAll } = useDashboardData();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterErgebnis, setFilterErgebnis] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TestfallErfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestfallErfassung | null>(null);
  const [exportingIds, setExportingIds] = useState<Set<string>>(new Set());

  async function handleExport(record: TestfallErfassung) {
    const id = record.record_id;
    setExportingIds(prev => new Set(prev).add(id));
    const abg = statusStats.abgeschlossen;
    const pct = (n: number) => abg > 0 ? `${Math.round((n / abg) * 100)} %` : '–';
    try {
      const result = await executeAction(APP_IDS.TESTFALL_ERFASSUNG, 'export_testcase_word', {
        record_id: id,
        statistik_offen: statusStats.offen,
        statistik_in_bearbeitung: statusStats.in_bearbeitung,
        statistik_abgeschlossen: statusStats.abgeschlossen,
        statistik_blockiert: statusStats.blockiert,
        statistik_offen_pct: pct(statusStats.offen),
        statistik_in_bearbeitung_pct: pct(statusStats.in_bearbeitung),
        statistik_blockiert_pct: pct(statusStats.blockiert),
      });
      if (result.error) return;
      const stdout = result.stdout?.trim() ?? '';
      if (stdout.startsWith('http')) {
        const filename = stdout.split('/').pop() ?? 'testfall.docx';
        await downloadFile(stdout, filename);
      } else {
        // Dateiliste aktualisieren und neueste Datei herunterladen
        const { files } = await fetchActionsAndFiles();
        const appFiles = files
          .filter(f => f.app_id === APP_IDS.TESTFALL_ERFASSUNG)
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        if (appFiles.length > 0) {
          await downloadFile(appFiles[0].url, appFiles[0].filename);
        }
      }
    } finally {
      setExportingIds(prev => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  const statusStats = useMemo(() => {
    const counts = { offen: 0, in_bearbeitung: 0, abgeschlossen: 0, blockiert: 0 };
    for (const r of testfallErfassung) {
      const key = r.fields.teststatus?.key ?? '';
      if (key in counts) counts[key as keyof typeof counts]++;
    }
    return counts;
  }, [testfallErfassung]);

  const priorityOptions = LOOKUP_OPTIONS['testfall_erfassung']?.prioritaet ?? [];
  const ergebnisOptions = LOOKUP_OPTIONS['testfall_erfassung']?.testergebnis ?? [];
  const statusOptions = LOOKUP_OPTIONS['testfall_erfassung']?.teststatus ?? [];

  const filtered = useMemo(() => {
    return testfallErfassung.filter(r => {
      const f = r.fields;
      const q = search.toLowerCase();
      if (q) {
        const haystack = [
          f.testfall_name, f.testfall_beschreibung, f.software_version,
          f.tester_vorname, f.tester_nachname,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filterStatus !== 'all' && f.teststatus?.key !== filterStatus) return false;
      if (filterPriority !== 'all' && f.prioritaet?.key !== filterPriority) return false;
      if (filterErgebnis !== 'all' && f.testergebnis?.key !== filterErgebnis) return false;
      return true;
    });
  }, [testfallErfassung, search, filterStatus, filterPriority, filterErgebnis]);

  async function handleSubmit(fields: TestfallErfassung['fields']) {
    if (editRecord) {
      await LivingAppsService.updateTestfallErfassungEntry(editRecord.record_id, fields);
    } else {
      await LivingAppsService.createTestfallErfassungEntry(fields);
    }
    fetchAll();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await LivingAppsService.deleteTestfallErfassungEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  }

  if (loading) return <PageSkeleton />;
  if (error) return (
    <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
      <IconAlertCircle size={32} className="text-destructive" />
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <Button variant="outline" size="sm" onClick={fetchAll}>Erneut versuchen</Button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ── Back button ── */}
      <div>
        <a
          href="#/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <IconArrowLeft size={14} className="shrink-0" />
          Zurück zum Dashboard
        </a>
        <h1 className="text-2xl font-bold text-foreground mt-2">Alle Testfälle</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Vollständige Liste aller erfassten Testfälle</p>
      </div>

      {/* ── Status-Statistik ── */}
      {(() => {
        const abg = statusStats.abgeschlossen;
        const fmt = (n: number) => abg > 0 ? `${Math.round((n / abg) * 100)} %` : '–';
        const stats = [
          { key: 'offen',         label: 'Offen',          count: statusStats.offen,          cls: 'border-blue-200 bg-blue-50',   badgeCls: 'bg-blue-100 text-blue-700 border-blue-200'   },
          { key: 'in_bearbeitung',label: 'In Bearbeitung', count: statusStats.in_bearbeitung,  cls: 'border-amber-200 bg-amber-50', badgeCls: 'bg-amber-100 text-amber-700 border-amber-200' },
          { key: 'abgeschlossen', label: 'Abgeschlossen',  count: statusStats.abgeschlossen,   cls: 'border-green-200 bg-green-50', badgeCls: 'bg-green-100 text-green-700 border-green-200' },
          { key: 'blockiert',     label: 'Blockiert',      count: statusStats.blockiert,       cls: 'border-red-200 bg-red-50',     badgeCls: 'bg-red-100 text-red-700 border-red-200'       },
        ];
        return (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {stats.map(s => (
              <div key={s.key} className={`rounded-2xl border ${s.cls} px-4 py-3 flex flex-col gap-1.5`}>
                <span className={`self-start inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.badgeCls}`}>
                  {s.label}
                </span>
                <span className="text-2xl font-bold text-foreground leading-none">{s.count}</span>
                <span className="text-xs text-muted-foreground">
                  {s.key === 'abgeschlossen'
                    ? 'Referenzwert'
                    : `${fmt(s.count)} von Abgeschlossen`}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground shrink-0" />
          <Input
            placeholder="Testfall suchen..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {statusOptions.map(o => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Priorität" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Prioritäten</SelectItem>
            {priorityOptions.map(o => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterErgebnis} onValueChange={setFilterErgebnis}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="Ergebnis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Ergebnisse</SelectItem>
            {ergebnisOptions.map(o => (
              <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => { setEditRecord(null); setDialogOpen(true); }}
          className="gap-2 ml-auto"
        >
          <IconPlus size={16} className="shrink-0" />
          <span>Neuer Testfall</span>
        </Button>
      </div>

      {/* ── List ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <IconClipboardList size={48} stroke={1.5} />
          <p className="text-sm">Keine Testfälle gefunden</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const f = r.fields;
            const testerName = [f.tester_vorname, f.tester_nachname].filter(Boolean).join(' ');
            const statusBarCls = STATUS_BAR[f.teststatus?.key ?? ''] ?? 'bg-slate-300';
            const priorityCls = PRIORITY_COLORS[f.prioritaet?.key ?? ''] ?? '';
            const ergebnisCls = ERGEBNIS_COLORS[f.testergebnis?.key ?? ''] ?? '';
            return (
              <div
                key={r.record_id}
                className="bg-card border border-border rounded-2xl overflow-hidden flex items-stretch hover:shadow-sm transition-shadow"
              >
                {/* farbiger linker Rand */}
                <div className={`w-1.5 shrink-0 ${statusBarCls}`} />
                <div className="flex-1 min-w-0 flex flex-wrap items-start gap-3 px-4 py-3">
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {f.testfall_name ?? '(Kein Name)'}
                    </span>
                    {f.prioritaet && priorityCls && (
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${priorityCls}`}>
                        <IconTag size={10} className="shrink-0" />
                        {f.prioritaet.label}
                      </span>
                    )}
                    {f.testergebnis && ergebnisCls && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${ergebnisCls}`}>
                        {f.testergebnis.label}
                      </span>
                    )}
                  </div>
                  {f.testfall_beschreibung && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{f.testfall_beschreibung}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {f.software_version && (
                      <span className="font-mono bg-muted px-1.5 py-0.5 rounded">v{f.software_version}</span>
                    )}
                    {f.testdatum && (
                      <span className="inline-flex items-center gap-1">
                        <IconCalendar size={11} className="shrink-0" />
                        {formatDate(f.testdatum)}
                      </span>
                    )}
                    {testerName && (
                      <span className="inline-flex items-center gap-1">
                        <IconUser size={11} className="shrink-0" />
                        {testerName}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={() => handleExport(r)}
                    disabled={exportingIds.has(r.record_id)}
                    title="Als Word exportieren"
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    {exportingIds.has(r.record_id)
                      ? <IconLoader2 size={14} className="shrink-0 animate-spin" />
                      : <IconFileExport size={14} className="shrink-0" />}
                  </button>
                  <button
                    onClick={() => { setEditRecord(r); setDialogOpen(true); }}
                    className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <IconPencil size={14} className="shrink-0" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(r)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <IconTrash size={14} className="shrink-0" />
                  </button>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Dialogs ── */}
      <TestfallErfassungDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={handleSubmit}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['TestfallErfassung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['TestfallErfassung']}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        title="Testfall löschen"
        description={`Soll "${deleteTarget?.fields.testfall_name ?? ''}" wirklich gelöscht werden?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-56" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
    </div>
  );
}
