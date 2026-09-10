import React, { useState, useEffect, useMemo } from 'react';
import { 
  TeachingLoad, 
  ScheduledLesson, 
  ViewPerspective, 
  DayOfWeek 
} from './types/timetable';
import { 
  loadSavedTeachingLoads, 
  saveTeachingLoads, 
  loadSavedScheduledLessons, 
  saveScheduledLessons, 
  exportTimetableToCSV, 
  exportTeachingLoadsToCSV,
  clearAllData 
} from './utils/storage';
import { 
  INITIAL_TEACHING_LOADS, 
  INITIAL_SCHEDULED_LESSONS 
} from './data/defaultTeachingLoads';

import { Header } from './components/Header';
import { ViewSelector } from './components/ViewSelector';
import { TeachingLoadPanel } from './components/TeachingLoadPanel';
import { TimetableGrid } from './components/TimetableGrid';
import { AddLoadModal } from './components/AddLoadModal';
import { ImportModal } from './components/ImportModal';
import { EditLessonModal } from './components/EditLessonModal';
import { StatsDrawer } from './components/StatsDrawer';
import { ConfirmDialog } from './components/ConfirmDialog';

export default function App() {
  // State for data
  const [teachingLoads, setTeachingLoads] = useState<TeachingLoad[]>(() => loadSavedTeachingLoads());
  const [scheduledLessons, setScheduledLessons] = useState<ScheduledLesson[]>(() => loadSavedScheduledLessons());

  // Navigation & View state
  const [viewMode, setViewMode] = useState<ViewPerspective>('teacher');
  const [selectedEntity, setSelectedEntity] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals & Drawers state
  const [isAddLoadOpen, setIsAddLoadOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [editingLoad, setEditingLoad] = useState<TeachingLoad | null>(null);
  const [editingLesson, setEditingLesson] = useState<ScheduledLesson | null>(null);

  // In-app confirmation dialog state
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    variant?: 'danger' | 'warning';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Sync state to localStorage
  useEffect(() => {
    saveTeachingLoads(teachingLoads);
  }, [teachingLoads]);

  useEffect(() => {
    saveScheduledLessons(scheduledLessons);
  }, [scheduledLessons]);

  // When viewMode changes, reset selectedEntity to 'ALL'
  const handleViewModeChange = (mode: ViewPerspective) => {
    setViewMode(mode);
    setSelectedEntity('ALL');
  };

  // Unique lists for autocompletion
  const existingTeachers = useMemo(
    () => Array.from(new Set(teachingLoads.map((l) => l.teacher))).sort(),
    [teachingLoads]
  );
  const existingClasses = useMemo(
    () => Array.from(new Set(teachingLoads.map((l) => l.className))).sort(),
    [teachingLoads]
  );
  const existingVenues = useMemo(
    () =>
      Array.from(
        new Set([
          ...teachingLoads.map((l) => l.venue).filter(Boolean),
          ...scheduledLessons.map((s) => s.venue).filter(Boolean),
        ])
      ).sort(),
    [teachingLoads, scheduledLessons]
  );

  // -------------------------------------------------------------
  // Lesson Operations
  // -------------------------------------------------------------
  const handleLessonPlaced = (newLesson: {
    loadId: string;
    teacher: string;
    className: string;
    module: string;
    venue: string;
    day: DayOfWeek;
    startHour: number;
    durationHours: number;
    color?: string;
  }) => {
    const created: ScheduledLesson = {
      id: `sched-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      ...newLesson,
    };
    setScheduledLessons((prev) => [...prev, created]);
  };

  const handleLessonMoved = (lessonId: string, day: DayOfWeek, startHour: number) => {
    setScheduledLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, day, startHour } : l))
    );
  };

  const handleLessonDeleted = (lessonId: string) => {
    setScheduledLessons((prev) => prev.filter((l) => l.id !== lessonId));
  };

  const handleLessonUpdated = (updatedLesson: ScheduledLesson) => {
    setScheduledLessons((prev) =>
      prev.map((l) => (l.id === updatedLesson.id ? updatedLesson : l))
    );
  };

  const handleQuickDurationChange = (lessonId: string, newDuration: number) => {
    setScheduledLessons((prev) =>
      prev.map((l) => (l.id === lessonId ? { ...l, durationHours: newDuration } : l))
    );
  };

  // -------------------------------------------------------------
  // Teaching Load Operations
  // -------------------------------------------------------------
  const handleSaveLoad = (loadData: Omit<TeachingLoad, 'id'>, id?: string) => {
    if (id) {
      // Edit existing load
      setTeachingLoads((prev) =>
        prev.map((l) => (l.id === id ? { ...loadData, id } : l))
      );
      // Also update any scheduled instances of this load with new teacher/class/module/venue/color
      setScheduledLessons((prev) =>
        prev.map((s) =>
          s.loadId === id
            ? {
                ...s,
                teacher: loadData.teacher,
                className: loadData.className,
                module: loadData.module,
                venue: loadData.venue,
                color: loadData.color,
              }
            : s
        )
      );
    } else {
      // Create new load
      const newLoad: TeachingLoad = {
        ...loadData,
        id: `load-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      };
      setTeachingLoads((prev) => [...prev, newLoad]);
    }
  };

  const handleDeleteLoad = (loadId: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Delete Teaching Load',
      message: 'Are you sure you want to delete this teaching load and remove all its scheduled slots from the weekly timetable?',
      confirmLabel: 'Delete Load',
      variant: 'danger',
      onConfirm: () => {
        setTeachingLoads((prev) => prev.filter((l) => l.id !== loadId));
        setScheduledLessons((prev) => prev.filter((s) => s.loadId !== loadId));
      },
    });
  };

  const handleImport = (newLoads: TeachingLoad[], replaceAll: boolean) => {
    if (replaceAll) {
      setTeachingLoads(newLoads);
      setScheduledLessons([]);
    } else {
      setTeachingLoads((prev) => [...prev, ...newLoads]);
    }
  };

  const handleClearSchedule = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear Weekly Grid',
      message: 'Clear all scheduled lesson blocks from the weekly timetable? Your teaching load list on the left will remain intact.',
      confirmLabel: 'Clear Grid',
      variant: 'warning',
      onConfirm: () => {
        setScheduledLessons([]);
      },
    });
  };

  const handleClearLoads = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear Teaching Loads',
      message: 'Remove all teaching loads from the list? Any scheduled lessons belonging to them will also be removed from the timetable.',
      confirmLabel: 'Clear Loads',
      variant: 'danger',
      onConfirm: () => {
        setTeachingLoads([]);
        setScheduledLessons([]);
      },
    });
  };

  const handleClearAll = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear All Data',
      message: 'Clear everything? This will remove all teaching loads and all scheduled timetable slots so you can start with a completely fresh, blank slate.',
      confirmLabel: 'Clear Everything',
      variant: 'danger',
      onConfirm: () => {
        clearAllData();
        setTeachingLoads([]);
        setScheduledLessons([]);
      },
    });
  };

  const handleResetSample = () => {
    setConfirmConfig({
      isOpen: true,
      title: 'Reset to Sample Data',
      message: 'Reset both timetable schedule and teaching loads back to the default sample dataset?',
      confirmLabel: 'Reset to Sample',
      variant: 'warning',
      onConfirm: () => {
        clearAllData();
        setTeachingLoads(INITIAL_TEACHING_LOADS);
        setScheduledLessons(INITIAL_SCHEDULED_LESSONS);
      },
    });
  };

  const handleExportCSV = () => {
    const csvContent = exportTimetableToCSV(scheduledLessons);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `timetable_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportHTML = async () => {
    try {
      // Use cache-busting parameter and no-cache request header to ensure latest template is always downloaded
      const res = await fetch(`/standalone-timetable.html?v=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });
      if (res.ok) {
        let htmlText = await res.text();
        const safeLoads = JSON.stringify(teachingLoads).replace(/</g, '\\u003c');
        const safeLessons = JSON.stringify(scheduledLessons).replace(/</g, '\\u003c');
        const closeScript = '<' + '/script>';
        const injection = `<script>window.__PRELOADED_TEACHING_LOADS__=${safeLoads};window.__PRELOADED_SCHEDULED_LESSONS__=${safeLessons};${closeScript}`;
        if (htmlText.includes('<head>')) {
          htmlText = htmlText.replace('<head>', `<head>${injection}`);
        } else {
          htmlText = `${injection}\n${htmlText}`;
        }
        const blob = new Blob([htmlText], { type: 'text/html;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute(
          'download',
          `Teacher_Timetable_Planner_Standalone_${new Date().toISOString().slice(0, 10)}.html`
        );
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (err) {
      console.warn('Could not fetch pre-bundled standalone file, generating fallback', err);
    }

    // Fallback: serialize current DOM
    const docHtml = '<!DOCTYPE html>\n' + document.documentElement.outerHTML;
    const blob = new Blob([docHtml], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Teacher_Timetable_Planner_Standalone_${new Date().toISOString().slice(0, 10)}.html`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSelectEntityFromStats = (entity: string, mode: 'teacher' | 'class' | 'venue') => {
    setViewMode(mode);
    setSelectedEntity(entity);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased p-2 sm:p-3 gap-3">
      
      {/* Top Application Header */}
      <Header
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenAddLoad={() => {
          setEditingLoad(null);
          setIsAddLoadOpen(true);
        }}
        onOpenStats={() => setIsStatsOpen(true)}
        onExportCSV={handleExportCSV}
        onExportHTML={handleExportHTML}
        onClearSchedule={handleClearSchedule}
        onClearAll={handleClearAll}
        onResetSample={handleResetSample}
        onPrint={handlePrint}
        totalScheduledCount={scheduledLessons.length}
        totalLoadsCount={teachingLoads.length}
      />

      {/* Perspective View & Search Sub-Header */}
      <ViewSelector
        viewMode={viewMode}
        selectedEntity={selectedEntity}
        onSelectEntity={setSelectedEntity}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        allLoads={teachingLoads}
        allScheduled={scheduledLessons}
      />

      {/* Main Dual-Panel Planning Workspace */}
      <div className="flex flex-col lg:flex-row flex-1 gap-3 overflow-hidden">
        
        {/* Left Panel: Teaching Load (Mindmap: "list lessons imported in the teaching load") */}
        <TeachingLoadPanel
          teachingLoads={teachingLoads}
          scheduledLessons={scheduledLessons}
          onOpenAddLoad={() => {
            setEditingLoad(null);
            setIsAddLoadOpen(true);
          }}
          onOpenImport={() => setIsImportOpen(true)}
          onEditLoad={(load) => {
            setEditingLoad(load);
            setIsAddLoadOpen(true);
          }}
          onDeleteLoad={handleDeleteLoad}
          onClearLoads={handleClearLoads}
          selectedFilterEntity={selectedEntity !== 'ALL' ? selectedEntity : undefined}
          onSelectEntity={setSelectedEntity}
          viewMode={viewMode}
        />

        {/* Right Panel: Timetable Panel (Mindmap: "The area in which user plans the timetable, Shows Monday to Friday, Shows 8am - 6pm, half hour granularity") */}
        <TimetableGrid
          scheduledLessons={scheduledLessons}
          teachingLoads={teachingLoads}
          viewMode={viewMode}
          selectedEntity={selectedEntity}
          searchQuery={searchQuery}
          onLessonPlaced={handleLessonPlaced}
          onLessonMoved={handleLessonMoved}
          onLessonDeleted={handleLessonDeleted}
          onEditLesson={(lesson) => setEditingLesson(lesson)}
          onQuickDurationChange={handleQuickDurationChange}
          onSelectEntity={setSelectedEntity}
        />

      </div>

      {/* Modals & Drawers */}
      <AddLoadModal
        isOpen={isAddLoadOpen}
        onClose={() => {
          setIsAddLoadOpen(false);
          setEditingLoad(null);
        }}
        onSave={handleSaveLoad}
        initialLoad={editingLoad}
        existingTeachers={existingTeachers}
        existingClasses={existingClasses}
        existingVenues={existingVenues}
      />

      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImport={handleImport}
      />

      <EditLessonModal
        isOpen={!!editingLesson}
        onClose={() => setEditingLesson(null)}
        lesson={editingLesson}
        allScheduled={scheduledLessons}
        allLoads={teachingLoads}
        existingVenues={existingVenues}
        onSave={handleLessonUpdated}
        onDelete={handleLessonDeleted}
      />

      <StatsDrawer
        isOpen={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        allLoads={teachingLoads}
        allScheduled={scheduledLessons}
        onSelectEntity={handleSelectEntityFromStats}
      />

      <ConfirmDialog
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmLabel={confirmConfig.confirmLabel}
        variant={confirmConfig.variant}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig((prev) => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
