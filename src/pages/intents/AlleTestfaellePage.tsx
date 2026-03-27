import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { TestfallErfassung } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formatDate } from '@/lib/formatters';
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

export default function AlleTestfaellePage() {
  const { testfallErfassung, loading, error, fetchAll } = useDashboardData();

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterErgebnis, setFilterErgebnis] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<TestfallErfassung | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TestfallErfassung | null>(null);

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
            const statusCls = STATUS_COLORS[f.teststatus?.key ?? ''] ?? 'bg-slate-100 text-slate-500 border-slate-200';
            const priorityCls = PRIORITY_COLORS[f.prioritaet?.key ?? ''] ?? '';
            const ergebnisCls = ERGEBNIS_COLORS[f.testergebnis?.key ?? ''] ?? '';
            return (
              <div
                key={r.record_id}
                className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-wrap items-start gap-3 hover:shadow-sm transition-shadow"
              >
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm text-foreground truncate">
                      {f.testfall_name ?? '(Kein Name)'}
                    </span>
                    {f.teststatus && (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusCls}`}>
                        {f.teststatus.label}
                      </span>
                    )}
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
