import React, { useState, useEffect } from 'react';
import { Copy, RefreshCw, ShieldCheck, History, Trash2, Download, Eye, EyeOff, Zap, Star } from 'lucide-react';

interface PasswordOptions {
  length: number;
  includeUppercase: boolean;
  includeLowercase: boolean;
  includeNumbers: boolean;
  includeSymbols: boolean;
  excludeSimilar: boolean;
  pronounceable: boolean;
}

interface PasswordEntry {
  id: string;
  password: string;
  timestamp: Date;
  strength: number;
  options: PasswordOptions;
}

function getSecureRandom(max: number): number {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function calculatePasswordStrength(password: string): number {
  let score = 0;
  
  // Length bonus
  if (password.length >= 8) score += 25;
  if (password.length >= 12) score += 25;
  if (password.length >= 16) score += 25;
  
  // Character variety
  if (/[a-z]/.test(password)) score += 5;
  if (/[A-Z]/.test(password)) score += 5;
  if (/[0-9]/.test(password)) score += 5;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  
  return Math.min(100, score);
}

function generatePassword(options: PasswordOptions, existingPasswords: Set<string>): string {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*()_+-=[]{}|;:,.<>?';
  const similarChars = 'il1Lo0O';
  
  let chars = '';
  if (options.includeUppercase) chars += uppercase;
  if (options.includeLowercase) chars += lowercase;
  if (options.includeNumbers) chars += numbers;
  if (options.includeSymbols) chars += symbols;

  if (options.excludeSimilar) {
    chars = chars.split('').filter(char => !similarChars.includes(char)).join('');
  }

  if (chars === '') chars = lowercase;

  let attempts = 0;
  const maxAttempts = 10000;

  while (attempts < maxAttempts) {
    let password = '';
    const charArray = Array.from(chars);
    
    for (let i = 0; i < options.length; i++) {
      let char;
      let charAttempts = 0;
      do {
        const randomIndex = getSecureRandom(charArray.length);
        char = charArray[randomIndex];
        charAttempts++;
      } while (i > 0 && password[i - 1] === char && charAttempts < 50);
      password += char;
    }

    if (!existingPasswords.has(password)) {
      return password;
    }
    attempts++;
  }

  // Fallback: add timestamp to ensure uniqueness
  const basePassword = generateSimplePassword(options, chars);
  const timestamp = Date.now().toString().slice(-4);
  return basePassword.slice(0, -4) + timestamp;
}

function generateSimplePassword(options: PasswordOptions, chars: string): string {
  let password = '';
  const charArray = Array.from(chars);
  
  for (let i = 0; i < options.length; i++) {
    const randomIndex = getSecureRandom(charArray.length);
    password += charArray[randomIndex];
  }
  
  return password;
}

function App() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [passwordHistory, setPasswordHistory] = useState<PasswordEntry[]>([]);
  const [showPassword, setShowPassword] = useState(true);
  const [copySuccess, setCopySuccess] = useState(false);
  const [options, setOptions] = useState<PasswordOptions>({
    length: 12,
    includeUppercase: true,
    includeLowercase: true,
    includeNumbers: true,
    includeSymbols: true,
    excludeSimilar: false,
    pronounceable: false,
  });

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('passwordHistory');
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory).map((entry: any) => ({
        ...entry,
        timestamp: new Date(entry.timestamp)
      }));
      setPasswordHistory(parsed);
    }
  }, []);

  // Save history to localStorage
  useEffect(() => {
    if (passwordHistory.length > 0) {
      localStorage.setItem('passwordHistory', JSON.stringify(passwordHistory));
    }
  }, [passwordHistory]);

  const generateNewPassword = () => {
    setLoading(true);
    setTimeout(() => {
      const existingPasswords = new Set(passwordHistory.map(entry => entry.password));
      const newPassword = generatePassword(options, existingPasswords);
      const strength = calculatePasswordStrength(newPassword);
      
      const newEntry: PasswordEntry = {
        id: crypto.randomUUID(),
        password: newPassword,
        timestamp: new Date(),
        strength,
        options: { ...options }
      };

      setPassword(newPassword);
      setPasswordHistory(prev => [newEntry, ...prev.slice(0, 99)]); // Keep last 100 passwords
      setLoading(false);
    }, 1500);
  };

  useEffect(() => {
    setTimeout(() => {
      setInitialLoading(false);
      generateNewPassword();
    }, 3000);
  }, []);

  const copyToClipboard = async (text: string = password) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar senha:', err);
    }
  };

  const clearHistory = () => {
    if (confirm('Tem certeza que deseja limpar todo o histórico?')) {
      setPasswordHistory([]);
      localStorage.removeItem('passwordHistory');
    }
  };

  const exportHistory = () => {
    const data = passwordHistory.map(entry => ({
      password: entry.password,
      timestamp: entry.timestamp.toISOString(),
      strength: entry.strength
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `senhas-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStrengthColor = (strength: number) => {
    if (strength >= 80) return 'text-green-400';
    if (strength >= 60) return 'text-yellow-400';
    if (strength >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getStrengthText = (strength: number) => {
    if (strength >= 80) return 'Muito Forte';
    if (strength >= 60) return 'Forte';
    if (strength >= 40) return 'Média';
    return 'Fraca';
  };

  if (initialLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
        style={{
          backgroundImage: 'url("https://images.unsplash.com/photo-1484589065579-248aad0d8b13?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80")',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative text-center">
          <ShieldCheck className="text-red-500 w-24 h-24 mx-auto mb-6 animate-pulse" />
          <h1 className="text-4xl font-bold text-red-500 mb-4">
            Gerador de Senhas Seguras
          </h1>
          <div className="flex items-center justify-center space-x-2">
            <div className="text-2xl text-red-500 animate-pulse">Inicializando Sistema de Segurança</div>
            <div className="animate-spin h-8 w-8 border-4 border-red-500 rounded-full border-t-transparent"></div>
          </div>
          <div className="mt-4 text-red-400">
            Carregando módulos de criptografia...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        backgroundImage: 'url("https://images.unsplash.com/photo-1484589065579-248aad0d8b13?ixlib=rb-1.2.1&auto=format&fit=crop&w=1950&q=80")',
        backgroundSize: 'cover',
        backgroundPosition: 'center'
      }}
    >
      <div className="absolute inset-0 bg-black/50"></div>

      <div className="relative bg-black/80 backdrop-blur-sm rounded-xl shadow-2xl p-8 w-full max-w-4xl border border-red-500/30">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center">
            <ShieldCheck className="text-red-500 w-12 h-12 mr-3" />
            <h1 className="text-3xl font-bold text-red-500">
              Gerador de Senhas Avançado
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="p-3 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
              title="Ver Histórico"
            >
              <History size={24} className="text-red-500" />
            </button>
            {passwordHistory.length > 0 && (
              <>
                <button
                  onClick={exportHistory}
                  className="p-3 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
                  title="Exportar Histórico"
                >
                  <Download size={24} className="text-red-500" />
                </button>
                <button
                  onClick={clearHistory}
                  className="p-3 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/30"
                  title="Limpar Histórico"
                >
                  <Trash2 size={24} className="text-red-500" />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Password Generator Section */}
          <div className="space-y-6">
            <div>
              <div className="relative">
                {loading ? (
                  <div className="w-full px-4 py-3 rounded-lg bg-black border border-red-500/30 text-red-500 flex items-center justify-center">
                    <div className="flex items-center space-x-2">
                      <Zap className="animate-pulse" size={20} />
                      <div className="animate-pulse text-xl">Gerando Senha Única</div>
                      <div className="animate-spin h-5 w-5 border-2 border-red-500 rounded-full border-t-transparent"></div>
                    </div>
                  </div>
                ) : (
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    readOnly
                    aria-label="Senha gerada"
                    placeholder="A senha gerada aparecerá aqui"
                    className="w-full px-4 py-3 rounded-lg bg-black border border-red-500/30 text-red-500 text-xl focus:outline-none focus:ring-2 focus:ring-red-500/50 pr-32"
                  />
                )}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                    title={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showPassword ? <EyeOff size={20} className="text-red-500" /> : <Eye size={20} className="text-red-500" />}
                  </button>
                  <button
                    onClick={() => copyToClipboard()}
                    disabled={loading}
                    className={`p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50 ${copySuccess ? 'bg-green-500/20' : ''}`}
                    title="Copiar senha"
                  >
                    <Copy size={20} className={copySuccess ? "text-green-500" : "text-red-500"} />
                  </button>
                  <button
                    onClick={generateNewPassword}
                    disabled={loading}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Gerar nova senha"
                  >
                    <RefreshCw size={20} className="text-red-500" />
                  </button>
                </div>
              </div>
              
              {password && (
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Star className="text-yellow-400" size={16} />
                    <span className="text-sm text-red-400">
                      Força: <span className={getStrengthColor(calculatePasswordStrength(password))}>
                        {getStrengthText(calculatePasswordStrength(password))} ({calculatePasswordStrength(password)}%)
                      </span>
                    </span>
                  </div>
                  <div className="text-sm text-red-400">
                    Total geradas: {passwordHistory.length}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xl font-medium text-red-500 mb-2">
                  Tamanho da Senha: {options.length}
                </label>
                <input
                  type="range"
                  min="6"
                  max="64"
                  value={options.length}
                  onChange={(e) =>
                    setOptions({ ...options, length: parseInt(e.target.value) })
                  }
                  className="w-full h-3 bg-red-900/50 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 gap-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.includeUppercase}
                    onChange={(e) =>
                      setOptions({ ...options, includeUppercase: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-red-500 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-500 text-lg">Incluir Letras Maiúsculas (A-Z)</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.includeLowercase}
                    onChange={(e) =>
                      setOptions({ ...options, includeLowercase: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-red-500 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-500 text-lg">Incluir Letras Minúsculas (a-z)</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.includeNumbers}
                    onChange={(e) =>
                      setOptions({ ...options, includeNumbers: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-red-500 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-500 text-lg">Incluir Números (0-9)</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.includeSymbols}
                    onChange={(e) =>
                      setOptions({ ...options, includeSymbols: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-red-500 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-500 text-lg">Incluir Símbolos (!@#$%)</span>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={options.excludeSimilar}
                    onChange={(e) =>
                      setOptions({ ...options, excludeSimilar: e.target.checked })
                    }
                    className="w-5 h-5 rounded bg-black border-red-500 text-red-500 focus:ring-red-500"
                  />
                  <span className="text-red-500 text-lg">Excluir Caracteres Similares (i, l, 1, L, o, 0, O)</span>
                </label>
              </div>

              <button
                onClick={generateNewPassword}
                disabled={loading}
                className="w-full bg-red-500/20 text-red-500 py-4 rounded-lg font-semibold text-xl hover:bg-red-500/30 transition-colors border border-red-500/30 disabled:opacity-50 flex items-center justify-center space-x-2"
              >
                <Zap size={24} />
                <span>Gerar Nova Senha Única</span>
              </button>
            </div>
          </div>

          {/* History Section */}
          {showHistory && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-red-500 flex items-center space-x-2">
                <History size={24} />
                <span>Histórico de Senhas</span>
              </h2>
              
              <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
                {passwordHistory.length === 0 ? (
                  <p className="text-red-400 text-center py-8">Nenhuma senha gerada ainda</p>
                ) : (
                  passwordHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="bg-black/50 border border-red-500/20 rounded-lg p-3 hover:border-red-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-red-400">
                          {entry.timestamp.toLocaleString('pt-BR')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm ${getStrengthColor(entry.strength)}`}>
                            {getStrengthText(entry.strength)}
                          </span>
                          <button
                            onClick={() => copyToClipboard(entry.password)}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            title="Copiar senha"
                          >
                            <Copy size={16} className="text-red-500" />
                          </button>
                        </div>
                      </div>
                      <div className="font-mono text-red-500 text-sm break-all">
                        {entry.password}
                      </div>
                      <div className="text-xs text-red-400 mt-1">
                        Tamanho: {entry.password.length} | Força: {entry.strength}%
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {copySuccess && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            ✓ Senha copiada com sucesso!
          </div>
        )}
      </div>
    </div>
  );
}

export default App;