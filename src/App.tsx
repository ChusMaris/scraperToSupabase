import React, { useState, useCallback, useEffect } from 'react';
import { MatchJob, ScrapeStatus, extractMatchId } from './types';
import { UploadMetadata, fetchCategorias, fetchTemporadas, fetchCompeticiones } from './services/supabaseService';
import { normalizeImportUrls, runImportBatch } from './services/importService';
import JobCard from './components/JobCard';
import { PlayIcon, DownloadIcon, Spinner } from './components/Icon';

const DEFAULT_SINGLE_URL = "";

const App: React.FC = () => {
  const [inputUrls, setInputUrls] = useState(DEFAULT_SINGLE_URL);
  const [temporada, setTemporada] = useState("2025/26");
  const [categoria, setCategoria] = useState("");
  const [competicion, setCompeticion] = useState("");
  const [jornada, setJornada] = useState<number | "">("");
  const [isPrd, setIsPrd] = useState(false);
  const [jobs, setJobs] = useState<MatchJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [logs, setLogs] = useState<{msg: string, type: 'info' | 'success' | 'error' | 'data'}[]>([]);
  const [categoriasList, setCategoriasList] = useState<string[]>([]);
  const [temporadasList, setTemporadasList] = useState<string[]>([]);
  const [competicionesList, setCompeticionesList] = useState<string[]>([]);
  const logsEndRef = React.useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [logs]);

  const loadMasters = useCallback(async (silent = false) => {
    const [cats, temps, comps] = await Promise.all([
      fetchCategorias(),
      fetchTemporadas(),
      fetchCompeticiones()
    ]);

    if (cats.length > 0) setCategoriasList(cats);
    if (temps.length > 0) setTemporadasList(temps);
    if (comps.length > 0) setCompeticionesList(comps);

    if (!silent) {
      addLog(`Maestros cargados: ${cats.length} categorías, ${temps.length} temporadas, ${comps.length} competiciones.`, 'info');
    }
  }, []);

  // Fetch masters on mount
  useEffect(() => {
    loadMasters();
  }, [loadMasters]);

  const addLog = (msg: string, type: 'info' | 'success' | 'error' | 'data' = 'info') => {
    setLogs(prev => [...prev, { msg, type }]);
  };

  const syncJob = (updatedJob: MatchJob) => {
    setJobs(prev => {
      const existing = prev.find(job => job.id === updatedJob.id);
      if (!existing) {
        return [...prev, updatedJob];
      }
      return prev.map(job => job.id === updatedJob.id ? updatedJob : job);
    });
  };

  const handleStart = async () => {
    addLog(`[UI] Iniciando procesamiento de lista de URLs...`, 'info');

    const urls = normalizeImportUrls(inputUrls);

    if (urls.length === 0) {
      setStatusMessage("No se han proporcionado URLs válidas.");
      addLog(`❌ No hay URLs para procesar.`, 'error');
      return;
    }

    setIsProcessing(true);
    setStatusMessage(`Preparando ${urls.length} partidos...`);

    const initialJobs: MatchJob[] = urls.map((url, index) => {
      const id = extractMatchId(url);
      return {
        id: id || `unknown-${index}`,
        url,
        status: ScrapeStatus.IDLE,
        statsFileDownloaded: false,
        movesFileDownloaded: false,
        matchTitle: id ? `Partido ${id}` : "URL Inválida"
      };
    });

    setJobs(initialJobs);
    addLog(`Cola de trabajo creada con ${initialJobs.length} elementos.`, 'success');

    const metadata: UploadMetadata = { temporada, categoria, competicion };
    const manualJornadaNum = jornada !== "" ? Number(jornada) : null;

    try {
      await runImportBatch({
        urls,
        metadata,
        isPrd,
        manualJornada: manualJornadaNum,
        onLog: addLog,
        onJobUpdate: syncJob,
        onStatusChange: setStatusMessage
      });
    } finally {
      setIsProcessing(false);
      if (isPrd) {
        loadMasters(true);
      }
    }
  };

  const handleRetry = async (job: MatchJob) => {
    if (isProcessing) return;

    setIsProcessing(true);
    const metadata: UploadMetadata = { temporada, categoria, competicion };
    const manualJornadaNum = jornada !== "" ? Number(jornada) : null;

    try {
      await runImportBatch({
        urls: [job.url],
        metadata,
        isPrd,
        manualJornada: manualJornadaNum,
        onLog: addLog,
        onJobUpdate: syncJob,
        onStatusChange: setStatusMessage
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen p-4 sm:p-8 flex flex-col items-center">
      
      <header className="mb-8 text-center max-w-2xl">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-basketball-600 text-white mb-4 shadow-lg shadow-basketball-900/50">
          <DownloadIcon />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">BasquetCatala <span className="text-basketball-500">JSON Scraper</span></h1>
        <p className="text-slate-400">
          Pega una lista de enlaces de estadísticas y súbelos directamente a <strong>Supabase</strong>.
          <br/>
          <span className="text-xs text-slate-500 uppercase tracking-widest font-bold mt-2 block">
            Multi-Match Data Pipeline
          </span>
        </p>
      </header>

      <main className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Controls */}
        <div className="p-6 bg-slate-800/50 space-y-4">
          
          {/* Metadata Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Temporada
              </label>
              <input 
                type="text" 
                list="temporadas-list"
                value={temporada}
                onChange={(e) => setTemporada(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-basketball-500 disabled:opacity-50 font-mono text-sm"
              />
              <datalist id="temporadas-list">
                {temporadasList.map((t, idx) => (
                  <option key={idx} value={t} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                Categoría
              </label>
              <input 
                type="text" 
                list="categorias-list"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-basketball-500 disabled:opacity-50 font-mono text-sm"
              />
              <datalist id="categorias-list">
                {categoriasList.map((cat, idx) => (
                  <option key={idx} value={cat} />
                ))}
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex justify-between">
                Competición
              </label>
              <input 
                type="text" 
                list="competiciones-list"
                value={competicion}
                onChange={(e) => setCompeticion(e.target.value)}
                disabled={isProcessing}
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-basketball-500 disabled:opacity-50 font-mono text-sm"
              />
              <datalist id="competiciones-list">
                {competicionesList.map((c, idx) => (
                  <option key={idx} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Número de Jornada (Opcional)
              </label>
              <input 
                type="number" 
                value={jornada}
                onChange={(e) => setJornada(e.target.value === "" ? "" : Number(e.target.value))}
                disabled={isProcessing}
                placeholder="Auto-detectar si vacío"
                className="w-full bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-basketball-500 disabled:opacity-50 font-mono text-sm"
              />
            </div>
          </div>

          {/* URL Input (Textarea for multiple) */}
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Lista de URLs de Estadísticas (Una por línea)
            </label>
            <textarea 
              value={inputUrls}
              onChange={(e) => setInputUrls(e.target.value)}
              disabled={isProcessing}
              placeholder="Pega aquí los enlaces de los partidos..."
              className="w-full h-32 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-basketball-500 disabled:opacity-50 font-mono text-xs resize-none"
            />
          </div>

          {/* PRD Mode Checkbox */}
          <div className="flex items-center gap-3 p-3 bg-red-900/10 border border-red-900/20 rounded-lg">
            <input 
              type="checkbox" 
              id="prd-mode"
              checked={isPrd}
              onChange={(e) => setIsPrd(e.target.checked)}
              disabled={isProcessing}
              className="w-5 h-5 rounded border-slate-700 text-red-600 focus:ring-red-500 bg-slate-900"
            />
            <label htmlFor="prd-mode" className="text-sm font-bold text-red-400 cursor-pointer select-none">
              MODO PRODUCCIÓN (Activa llamadas reales a Supabase)
            </label>
          </div>
          
          {/* Action Button */}
          <button 
            onClick={handleStart}
            disabled={isProcessing}
            className={`w-full font-bold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${
              isPrd 
                ? 'bg-red-600 hover:bg-red-700 text-white shadow-red-900/20' 
                : 'bg-basketball-600 hover:bg-basketball-500 text-white shadow-basketball-900/20'
            }`}
          >
            {isProcessing ? <Spinner /> : <PlayIcon />}
            {isProcessing ? 'Working...' : isPrd ? 'Extract & UPLOAD ALL TO PRODUCTION' : 'Extract & Simulate All'}
          </button>

          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
             <p className="text-sm text-slate-400 font-mono">
                {statusMessage || "Ready to start."}
             </p>
             {jobs.length > 0 && (
                <span className="text-xs text-slate-500">
                  {jobs.filter(j => j.status === ScrapeStatus.COMPLETED).length} / {jobs.length} Completados
                </span>
             )}
          </div>
        </div>

        {/* Results List */}
        <div className="p-6 bg-slate-900 border-b border-slate-800 min-h-[200px] max-h-[400px] overflow-y-auto">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-basketball-500 animate-pulse"></span>
            Cola de Procesamiento
          </h2>
          {jobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-600 py-10">
              <p>No hay partidos en cola.</p>
            </div>
          ) : (
            <div className="space-y-2">
               {jobs.map(job => (
                 <JobCard key={job.id} job={job} onRetry={handleRetry} />
               ))}
            </div>
          )}
        </div>

        {/* Traces/Logs Section */}
        <div className="p-6 bg-black/40 font-mono text-xs overflow-hidden flex flex-col h-[300px]">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-slate-500 uppercase tracking-widest font-bold flex items-center gap-2">
              Traces & Data Simulation
              {isPrd ? (
                <span className="text-[10px] bg-red-500/20 text-red-400 px-2 py-0.5 rounded border border-red-500/30 animate-pulse">PRODUCTION</span>
              ) : (
                <span className="text-[10px] bg-basketball-500/20 text-basketball-400 px-2 py-0.5 rounded border border-basketball-500/30">SIMULATION</span>
              )}
            </h2>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  const logText = logs.map(l => `[${l.type}] ${l.msg}`).join('\n');
                  navigator.clipboard.writeText(logText);
                  alert("Logs copiados al portapapeles");
                }}
                className="text-[10px] text-basketball-500 hover:text-basketball-400 underline"
              >
                Copiar Logs
              </button>
              <button 
                onClick={() => setLogs([])}
                className="text-[10px] text-slate-600 hover:text-slate-400 underline"
              >
                Clear Logs
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {logs.length === 0 ? (
              <p className="text-slate-700 italic">Waiting for activity...</p>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={`break-words ${
                  log.type === 'error' ? 'text-red-400' : 
                  log.type === 'success' ? 'text-emerald-400' : 
                  log.type === 'data' ? 'text-blue-300' : 
                  'text-slate-400'
                }`}>
                  <span className="opacity-30 mr-2">[{new Date().toLocaleTimeString()}]</span>
                  {log.msg}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

      </main>
      
      <footer className="mt-8 text-slate-600 text-sm">
        Generated by AI Senior Engineer • React 18 • TypeScript • Tailwind
      </footer>
    </div>
  );
};

export default App;
