import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Copy, RefreshCw, ShieldCheck, History, Trash2, Download,
  Eye, EyeOff, Zap, ChevronDown, ChevronUp, Check, X,
  Lock, Unlock, Settings2, BarChart3, Hash, Layers
} from 'lucide-react';

interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  customSymbols: string;
  useCustomSymbols: boolean;
}

interface PasswordEntry {
  id: string;
  password: string;
  timestamp: Date;
  strength: number;
  entropy: number;
  options: PasswordOptions;
}

type Tab = 'generator' | 'history' | 'bulk';

const PRESETS = [
  { name: 'PIN', icon: Hash, options: { length: 6, includeUppercase: false, includeLowercase: false, includeNumbers: true, includeSymbols: false, excludeSimilar: false, customSymbols: '', useCustomSymbols: false } },
  { name: 'Web', icon: Lock, options: { length: 16, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: true, excludeSimilar: false, customSymbols: '', useCustomSymbols: false } },
  { name: 'Legivel', icon: Unlock, options: { length: 14, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: false, excludeSimilar: true, customSymbols: '', useCustomSymbols: false } },
  { name: 'Ultra', icon: ShieldCheck, options: { length: 32, includeUppercase: true, includeLowercase: true, includeNumbers: true, includeSymbols: true, excludeSimilar: false, customSymbols: '', useCustomSymbols: false } },
];

function secureRandom(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function calcEntropy(chars: number, length: number): number {
  return Math.floor(length * Math.log2(chars));
}

function calculateStrength(password: string): { score: number; label: string; color: string; bg: string } {
  let score = 0;
  if (password.length >= 8) score += 20;
  if (password.length >= 12) score += 15;
  if (password.length >= 16) score += 15;
  if (password.length >= 24) score += 10;
  if (/[a-z]/.test(password)) score += 8;
  if (/[A-Z]/.test(password)) score += 8;
  if (/[0-9]/.test(password)) score += 8;
  if (/[^A-Za-z0-9]/.test(password)) score += 16;
  score = Math.min(100, score);

  if (score >= 85) return { score, label: 'Excelente', color: 'text-emerald-400', bg: 'bg-emerald-400' };
  if (score >= 65) return { score, label: 'Forte', color: 'text-green-400', bg: 'bg-green-400' };
  if (score >= 45) return { score, label: 'Boa', color: 'text-yellow-400', bg: 'bg-yellow-400' };
  if (score >= 25) return { score, label: 'Fraca', color: 'text-orange-400', bg: 'bg-orange-400' };
  return { score, label: 'Muito Fraca', color: 'text-red-400', bg: 'bg-red-400' };
}

function buildCharset(options: PasswordOptions): string {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const nums = '0123456789';
  const syms = options.useCustomSymbols ? options.customSymbols : '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const similar = new Set(['i', 'l', '1', 'L', 'o', '0', 'O', 'I']);

  let chars = '';
  if (options.includeUppercase) chars += upper;
  if (options.includeLowercase) chars += lower;
  if (options.includeNumbers) chars += nums;
  if (options.includeSymbols) chars += syms;
  if (!chars) chars = lower;
  if (options.excludeSimilar) chars = [...chars].filter(c => !similar.has(c)).join('');
  return chars;
}

function generatePassword(options: PasswordOptions, existing: Set<string>): string {
  const chars = buildCharset(options);
  const arr = [...chars];

  for (let attempt = 0; attempt < 5000; attempt++) {
    let pw = '';
    for (let i = 0; i < options.length; i++) pw += arr[secureRandom(arr.length)];
    if (!existing.has(pw)) return pw;
  }
  return [...Array(options.length)].map(() => arr[secureRandom(arr.length)]).join('');
}

const DEFAULT_OPTIONS: PasswordOptions = {
  length: 16,
  includeUppercase: true,
  includeLowercase: true,
  includeNumbers: true,
  includeSymbols: true,
  excludeSimilar: false,
  customSymbols: '!@#$%^&*',
  useCustomSymbols: false,
};

export default function App() {
  const [options, setOptions] = useState<PasswordOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<PasswordEntry[]>([]);
  const [tab, setTab] = useState<Tab>('generator');
  const [bulkCount, setBulkCount] = useState(10);
  const [bulkPasswords, setBulkPasswords] = useState<string[]>([]);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>('Web');
  const _inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('pwgen_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map((e: PasswordEntry) => ({ ...e, timestamp: new Date(e.timestamp) }));
        setHistory(parsed);
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    if (history.length > 0) localStorage.setItem('pwgen_history', JSON.stringify(history.slice(0, 200)));
  }, [history]);

  const generate = useCallback((opts = options) => {
    setGenerating(true);
    setTimeout(() => {
      const existing = new Set(history.map(e => e.password));
      const pw = generatePassword(opts, existing);
      const chars = buildCharset(opts);
      const entropy = calcEntropy(chars.length, opts.length);
      const { score } = calculateStrength(pw);
      const entry: PasswordEntry = {
        id: crypto.randomUUID(),
        password: pw,
        timestamp: new Date(),
        strength: score,
        entropy,
        options: { ...opts },
      };
      setPassword(pw);
      setHistory(prev => [entry, ...prev.slice(0, 199)]);
      setGenerating(false);
    }, 400);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, history]);

  useEffect(() => {
    generate(DEFAULT_OPTIONS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    } catch { /* ignore */ }
  };

  const applyPreset = (preset: typeof PRESETS[0]) => {
    const newOpts = { ...options, ...preset.options };
    setOptions(newOpts);
    setActivePreset(preset.name);
    generate(newOpts);
  };

  const handleOptionChange = (key: keyof PasswordOptions, value: boolean | number | string) => {
    const newOpts = { ...options, [key]: value };
    setOptions(newOpts);
    setActivePreset(null);
  };

  const generateBulk = () => {
    setGeneratingBulk(true);
    setTimeout(() => {
      const existing = new Set<string>();
      const results: string[] = [];
      for (let i = 0; i < bulkCount; i++) {
        const pw = generatePassword(options, existing);
        existing.add(pw);
        results.push(pw);
      }
      setBulkPasswords(results);
      setGeneratingBulk(false);
    }, 600);
  };

  const exportBulk = () => {
    const blob = new Blob([bulkPasswords.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senhas-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHistory = () => {
    const data = history.map(e => ({
      password: e.password,
      timestamp: e.timestamp.toISOString(),
      strength: e.strength,
      entropy: e.entropy,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `historico-senhas-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearHistory = () => {
    if (confirm('Apagar todo o historico de senhas?')) {
      setHistory([]);
      localStorage.removeItem('pwgen_history');
    }
  };

  const strength = password ? calculateStrength(password) : null;
  const charset = buildCharset(options);
  const entropy = calcEntropy(charset.length, options.length);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-600/5 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-cyan-500/5 blur-[120px]" />
        <div className="absolute top-[40%] left-[40%] w-[400px] h-[400px] rounded-full bg-blue-900/8 blur-[100px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/5 bg-black/20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">SecurePass</h1>
              <p className="text-xs text-white/30">Gerador de Senhas Avancado</p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/30 bg-white/5 rounded-full px-3 py-1.5 border border-white/8">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Criptografia local</span>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">

        {/* Tabs */}
        <div className="flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/8 mb-8 w-fit">
          {([
            { id: 'generator', label: 'Gerador', icon: Zap },
            { id: 'history', label: `Historico${history.length ? ` (${history.length})` : ''}`, icon: History },
            { id: 'bulk', label: 'Em Massa', icon: Layers },
          ] as { id: Tab; label: string; icon: React.ElementType }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Generator Tab */}
        {tab === 'generator' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

            {/* Left: Output + Config */}
            <div className="lg:col-span-3 space-y-5">

              {/* Password Display */}
              <div className="group relative rounded-2xl bg-white/[0.03] border border-white/8 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-transparent pointer-events-none" />
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-white/30 uppercase tracking-widest">Senha Gerada</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setShowPassword(!showPassword)}
                        className="w-8 h-8 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-all"
                      >
                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                      <button
                        onClick={() => copy(password, 'main')}
                        disabled={generating || !password}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          copied === 'main'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'hover:bg-white/8 text-white/40 hover:text-white'
                        }`}
                      >
                        {copied === 'main' ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                      <button
                        onClick={() => generate()}
                        disabled={generating}
                        className="w-8 h-8 rounded-lg hover:bg-white/8 flex items-center justify-center text-white/40 hover:text-white transition-all"
                      >
                        <RefreshCw size={14} className={generating ? 'animate-spin' : ''} />
                      </button>
                    </div>
                  </div>

                  {generating ? (
                    <div className="h-14 flex items-center gap-3">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4].map(i => (
                          <div
                            key={i}
                            className="w-1.5 h-8 rounded-full bg-blue-500/40 animate-pulse"
                            style={{ animationDelay: `${i * 100}ms` }}
                          />
                        ))}
                      </div>
                      <span className="text-white/30 text-sm">Gerando senha segura...</span>
                    </div>
                  ) : (
                    <div
                      className="font-mono text-2xl md:text-3xl font-medium tracking-wider break-all leading-tight cursor-pointer select-all text-white/90"
                      style={{ filter: showPassword ? 'none' : 'blur(10px)' }}
                      onClick={() => copy(password, 'main')}
                      title="Clique para copiar"
                    >
                      {password || '\u2014'}
                    </div>
                  )}

                  {/* Strength Bar */}
                  {strength && !generating && (
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <BarChart3 size={12} className={strength.color} />
                          <span className={`text-xs font-medium ${strength.color}`}>{strength.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/25">
                          <span>{password.length} chars</span>
                          <span>{entropy} bits</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ease-out ${strength.bg}`}
                          style={{ width: `${strength.score}%` }}
                        />
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        {[
                          { ok: /[a-z]/.test(password), label: 'Min' },
                          { ok: /[A-Z]/.test(password), label: 'Mai' },
                          { ok: /[0-9]/.test(password), label: 'Num' },
                          { ok: /[^A-Za-z0-9]/.test(password), label: 'Sim' },
                          { ok: password.length >= 12, label: '12+' },
                          { ok: password.length >= 20, label: '20+' },
                        ].map(({ ok, label }) => (
                          <div
                            key={label}
                            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-all ${
                              ok ? 'bg-emerald-500/15 text-emerald-400' : 'bg-white/5 text-white/20'
                            }`}
                          >
                            {ok ? <Check size={9} /> : <X size={9} />}
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Presets */}
              <div>
                <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Predefinicoes Rapidas</p>
                <div className="grid grid-cols-4 gap-2">
                  {PRESETS.map(preset => (
                    <button
                      key={preset.name}
                      onClick={() => applyPreset(preset)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-medium transition-all ${
                        activePreset === preset.name
                          ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                          : 'bg-white/[0.03] border-white/8 text-white/40 hover:text-white/70 hover:border-white/15'
                      }`}
                    >
                      <preset.icon size={14} />
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate Button */}
              <button
                onClick={() => generate()}
                disabled={generating}
                className="w-full relative group overflow-hidden bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold py-4 rounded-xl transition-all duration-200 shadow-xl shadow-blue-600/20 hover:shadow-blue-500/30"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <span className="relative flex items-center justify-center gap-2">
                  <Zap size={16} />
                  {generating ? 'Gerando...' : 'Gerar Nova Senha'}
                </span>
              </button>
            </div>

            {/* Right: Options */}
            <div className="lg:col-span-2 space-y-4">
              <div className="rounded-2xl bg-white/[0.03] border border-white/8 p-5 space-y-5">
                {/* Length */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-white/70">Tamanho</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOptionChange('length', Math.max(4, options.length - 1))}
                        className="w-6 h-6 rounded-md bg-white/8 hover:bg-white/12 text-white/60 flex items-center justify-center text-xs transition-all"
                      >-</button>
                      <span className="text-sm font-mono font-bold text-white w-8 text-center">{options.length}</span>
                      <button
                        onClick={() => handleOptionChange('length', Math.min(128, options.length + 1))}
                        className="w-6 h-6 rounded-md bg-white/8 hover:bg-white/12 text-white/60 flex items-center justify-center text-xs transition-all"
                      >+</button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="4"
                    max="128"
                    value={options.length}
                    onChange={e => handleOptionChange('length', parseInt(e.target.value))}
                    className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, #2563eb ${((options.length - 4) / 124) * 100}%, rgba(255,255,255,0.08) ${((options.length - 4) / 124) * 100}%)`,
                    }}
                  />
                  <div className="flex justify-between text-xs text-white/20 mt-1.5">
                    <span>4</span><span>32</span><span>64</span><span>128</span>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-2.5">
                  {([
                    { key: 'includeUppercase', label: 'Maiusculas', sub: 'A\u2013Z' },
                    { key: 'includeLowercase', label: 'Minusculas', sub: 'a\u2013z' },
                    { key: 'includeNumbers', label: 'Numeros', sub: '0\u20139' },
                    { key: 'includeSymbols', label: 'Simbolos', sub: '!@#$' },
                    { key: 'excludeSimilar', label: 'Excluir similares', sub: 'il1Lo0O' },
                  ] as { key: keyof PasswordOptions; label: string; sub: string }[]).map(({ key, label, sub }) => (
                    <label
                      key={key}
                      className="flex items-center justify-between cursor-pointer group py-0.5"
                    >
                      <div>
                        <span className="text-sm text-white/70 group-hover:text-white/90 transition-colors">{label}</span>
                        <span className="text-xs text-white/25 ml-2 font-mono">{sub}</span>
                      </div>
                      <div
                        className={`relative w-9 h-5 rounded-full transition-all duration-200 ${
                          options[key] ? 'bg-blue-600' : 'bg-white/10'
                        }`}
                        onClick={() => handleOptionChange(key, !options[key])}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${
                            options[key] ? 'left-[18px]' : 'left-0.5'
                          }`}
                        />
                      </div>
                    </label>
                  ))}
                </div>

                {/* Advanced */}
                <div>
                  <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/50 transition-colors"
                  >
                    <Settings2 size={12} />
                    Opcoes avancadas
                    {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>

                  {showAdvanced && (
                    <div className="mt-3 space-y-3 pl-3 border-l border-white/8">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-sm text-white/60">Simbolos personalizados</span>
                        <div
                          className={`relative w-9 h-5 rounded-full transition-all duration-200 ${options.useCustomSymbols ? 'bg-blue-600' : 'bg-white/10'}`}
                          onClick={() => handleOptionChange('useCustomSymbols', !options.useCustomSymbols)}
                        >
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${options.useCustomSymbols ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                      </label>
                      {options.useCustomSymbols && (
                        <input
                          type="text"
                          value={options.customSymbols}
                          onChange={e => handleOptionChange('customSymbols', e.target.value)}
                          placeholder="Ex: !@#$"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-blue-500/50 font-mono"
                        />
                      )}
                      <div className="text-xs text-white/25">
                        Conjunto: <span className="font-mono text-white/35">{charset.length} chars</span> &middot; Entropia: <span className="font-mono text-white/35">{entropy} bits</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Historico de Senhas</h2>
                <p className="text-sm text-white/30">{history.length} senhas geradas</p>
              </div>
              <div className="flex gap-2">
                {history.length > 0 && (
                  <>
                    <button
                      onClick={exportHistory}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/8 border border-white/8 text-sm text-white/60 hover:text-white transition-all"
                    >
                      <Download size={14} />
                      Exportar
                    </button>
                    <button
                      onClick={clearHistory}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-sm text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-24 text-white/20">
                <History size={40} className="mx-auto mb-3 opacity-30" />
                <p>Nenhuma senha gerada ainda</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(entry => {
                  const s = calculateStrength(entry.password);
                  return (
                    <div
                      key={entry.id}
                      className="group flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/6 hover:border-white/10 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-sm text-white/80 truncate">{entry.password}</div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-white/25">{entry.timestamp.toLocaleString('pt-BR')}</span>
                          <span className={`text-xs font-medium ${s.color}`}>{s.label}</span>
                          <span className="text-xs text-white/20">{entry.entropy} bits</span>
                          <span className="text-xs text-white/20">{entry.password.length} chars</span>
                        </div>
                      </div>
                      <button
                        onClick={() => copy(entry.password, entry.id)}
                        className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 ${
                          copied === entry.id
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white'
                        }`}
                      >
                        {copied === entry.id ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bulk Tab */}
        {tab === 'bulk' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Geracao em Massa</h2>
              <p className="text-sm text-white/30">Gere multiplas senhas unicas de uma vez</p>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-sm text-white/50">Quantidade:</span>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={bulkCount}
                  onChange={e => setBulkCount(Math.min(500, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-24 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white text-center focus:outline-none focus:border-blue-500/50"
                />
                <span className="text-xs text-white/25">max 500</span>
              </div>
              <button
                onClick={generateBulk}
                disabled={generatingBulk}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-600/20"
              >
                <Zap size={14} className={generatingBulk ? 'animate-pulse' : ''} />
                {generatingBulk ? 'Gerando...' : 'Gerar'}
              </button>
              {bulkPasswords.length > 0 && (
                <button
                  onClick={exportBulk}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/8 border border-white/8 rounded-xl text-sm text-white/60 hover:text-white transition-all"
                >
                  <Download size={14} />
                  Exportar .txt
                </button>
              )}
            </div>

            {bulkPasswords.length > 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/8 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                  <span className="text-xs text-white/30 uppercase tracking-widest">{bulkPasswords.length} senhas geradas</span>
                  <button
                    onClick={() => copy(bulkPasswords.join('\n'), 'bulk-all')}
                    className={`flex items-center gap-1.5 text-xs transition-all ${copied === 'bulk-all' ? 'text-emerald-400' : 'text-white/30 hover:text-white/60'}`}
                  >
                    {copied === 'bulk-all' ? <Check size={11} /> : <Copy size={11} />}
                    Copiar tudo
                  </button>
                </div>
                <div className="max-h-[480px] overflow-y-auto">
                  {bulkPasswords.map((pw, i) => (
                    <div
                      key={i}
                      className="group flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] hover:bg-white/[0.03] last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-white/15 font-mono w-6 text-right">{i + 1}</span>
                        <span className="font-mono text-sm text-white/70">{pw}</span>
                      </div>
                      <button
                        onClick={() => copy(pw, `bulk-${i}`)}
                        className={`opacity-0 group-hover:opacity-100 w-7 h-7 rounded-md flex items-center justify-center transition-all ${
                          copied === `bulk-${i}` ? 'text-emerald-400' : 'text-white/30 hover:text-white'
                        }`}
                      >
                        {copied === `bulk-${i}` ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-5">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs text-white/15">Todas as senhas sao geradas localmente. Nenhum dado e enviado a servidores.</span>
          <div className="flex items-center gap-1 text-xs text-white/15">
            <Lock size={10} />
            <span>Web Crypto API</span>
          </div>
        </div>
      </footer>

      {/* Toast */}
      {copied === 'main' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-emerald-500 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-xl shadow-emerald-500/25 z-50">
          <Check size={14} />
          Senha copiada!
        </div>
      )}
    </div>
  );
}
