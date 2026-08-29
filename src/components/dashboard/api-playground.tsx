'use client';

import { useState, useCallback, useRef } from 'react';

// ── Types ──
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';
type RequestTab = 'body' | 'headers';
type ResponseTab = 'response' | 'headers' | 'logs';
type CodeTab = 'curl' | 'javascript' | 'python' | 'php';
type RequestState = 'idle' | 'loading' | 'success' | 'error';

interface LogEntry {
  timestamp: string;
  type: 'info' | 'request' | 'response' | 'error';
  message: string;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  time: number;
}

// ── Base URL ──
const API_BASE = process.env.NEXT_PUBLIC_KOBARA_API_URL || 'https://api.kobara.app';

// ── Endpoint presets ──
const ENDPOINTS = [
  { method: 'POST' as HttpMethod, path: '/v1/payments', label: 'Créer un paiement', body: JSON.stringify({
    amount: 1000,
    currency: "HTG",
    provider: "kobara",
    description: "Commande #1001",
    customer: { name: "Jean Exemple", phone: "50900000000" },
    success_url: "https://site.com/success",
    cancel_url: "https://site.com/error"
  }, null, 2) },
  { method: 'GET' as HttpMethod, path: '/v1/payments', label: 'Lister les paiements', body: '' },
  { method: 'POST' as HttpMethod, path: '/v1/payment-links', label: 'Créer un lien de paiement', body: JSON.stringify({
    title: "Paiement boutique",
    amount: 500,
    currency: "HTG",
    description: "Lien de paiement test"
  }, null, 2) },
  { method: 'GET' as HttpMethod, path: '/v1/payment-links', label: 'Lister les liens', body: '' },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  POST: 'bg-green-500/20 text-green-400 border-green-500/30',
  PUT: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_COLORS: Record<string, string> = {
  '2': 'text-green-400 bg-green-500/10 border-green-500/20',
  '3': 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  '4': 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  '5': 'text-red-400 bg-red-500/10 border-red-500/20',
};

function getStatusColor(status: number) {
  const prefix = String(status)[0];
  return STATUS_COLORS[prefix] || 'text-slate-400 bg-white/5 border-white/10';
}

// ── Component ──
export function ApiPlayground({ isTestMode, activeKey }: { isTestMode: boolean; activeKey: string }) {
  const [selectedEndpoint, setSelectedEndpoint] = useState(0);
  const [method, setMethod] = useState<HttpMethod>(ENDPOINTS[0].method);
  const [url, setUrl] = useState(`${API_BASE}${ENDPOINTS[0].path}`);
  const [body, setBody] = useState(ENDPOINTS[0].body);
  const [headers, setHeaders] = useState<{ key: string; value: string; enabled: boolean }[]>([
    { key: 'Authorization', value: `Bearer ${isTestMode ? 'kbr_sk_test_VOTRE_CLE_API' : 'kbr_sk_live_VOTRE_CLE_API'}`, enabled: true },
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Idempotency-Key', value: crypto.randomUUID(), enabled: true },
  ]);

  const [requestTab, setRequestTab] = useState<RequestTab>('body');
  const [responseTab, setResponseTab] = useState<ResponseTab>('response');
  const [codeTab, setCodeTab] = useState<CodeTab>('curl');

  const [requestState, setRequestState] = useState<RequestState>('idle');
  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const addLog = useCallback((type: LogEntry['type'], message: string) => {
    const now = new Date();
    setLogs(prev => [...prev, {
      timestamp: `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`,
      type,
      message,
    }]);
  }, []);

  // Select an endpoint preset
  const handleSelectEndpoint = (index: number) => {
    const ep = ENDPOINTS[index];
    setSelectedEndpoint(index);
    setMethod(ep.method);
    setUrl(`${API_BASE}${ep.path}`);
    setBody(ep.body);
    setResponse(null);
    setRequestState('idle');
    setLogs([]);
    setHeaders(prev => prev.map(h => 
      h.key === 'Idempotency-Key' 
        ? { ...h, value: crypto.randomUUID() } 
        : h
    ));
  };

  // Header helpers
  const addHeader = () => setHeaders(prev => [...prev, { key: '', value: '', enabled: true }]);
  const removeHeader = (i: number) => setHeaders(prev => prev.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, [field]: val } : h));
  const toggleHeader = (i: number) =>
    setHeaders(prev => prev.map((h, idx) => idx === i ? { ...h, enabled: !h.enabled } : h));

  // ── Send request through server-side proxy ──
  const sendRequest = async () => {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRequestState('loading');
    setResponse(null);
    setLogs([]);
    setResponseTab('response');

    // Build headers
    const reqHeaders: Record<string, string> = {};
    headers.filter(h => h.enabled && h.key).forEach(h => { reqHeaders[h.key] = h.value; });

    addLog('info', `Preparing ${method} request to ${url}`);
    addLog('request', `Headers: ${JSON.stringify(reqHeaders, null, 2)}`);
    if (body && method !== 'GET') {
      addLog('request', `Body: ${body.length > 200 ? body.substring(0, 200) + '...' : body}`);
    }
    addLog('info', 'Sending request via server proxy...');

    try {
      // Call our server-side proxy to avoid CORS
      const proxyRes = await fetch('/api/playground/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          url,
          method,
          headers: reqHeaders,
          body: body && method !== 'GET' ? body : undefined,
        }),
      });

      const data = await proxyRes.json();

      // Pretty-print JSON body if possible
      let prettyBody = data.body || '';
      try {
        prettyBody = JSON.stringify(JSON.parse(prettyBody), null, 2);
      } catch { /* keep as-is */ }

      const apiResponse: ApiResponse = {
        status: data.status,
        statusText: data.statusText,
        headers: data.headers || {},
        body: prettyBody,
        time: data.time,
      };

      setResponse(apiResponse);
      setRequestState(data.status >= 200 && data.status < 400 ? 'success' : 'error');

      addLog('response', `Status: ${data.status} ${data.statusText}`);
      addLog('response', `Time: ${data.time}ms`);
      addLog('info', 'Request completed.');
    } catch (err: any) {
      if (err.name === 'AbortError') {
        addLog('info', 'Request cancelled.');
        setRequestState('idle');
        return;
      }
      setResponse({
        status: 0,
        statusText: 'Network Error',
        headers: {},
        body: JSON.stringify({ error: err.message || 'Failed to connect' }, null, 2),
        time: 0,
      });
      setRequestState('error');
      addLog('error', `Error: ${err.message}`);
    }
  };

  // Copy response
  const copyResponse = () => {
    if (response) {
      navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // ── Code generation (dynamic) ──
  const generateCode = (): string => {
    switch (codeTab) {
      case 'curl': {
        let cmd = `curl -X ${method} "${url}"`;
        headers.filter(h => h.enabled && h.key).forEach(h => {
          cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
        });
        if (method === 'POST') {
          cmd += ` \\\n  -H "Idempotency-Key: $(uuidgen)"`;
        }
        if (body && method !== 'GET') cmd += ` \\\n  -d '${body}'`;
        return cmd;
      }
      case 'javascript': {
        const hObj: Record<string, string> = {};
        headers.filter(h => h.enabled && h.key).forEach(h => { hObj[h.key] = h.value; });
        
        let code = '';
        if (method === 'POST') {
          code += `// Generate unique Idempotency-Key for sensitive operations\n`;
          code += `const headers = ${JSON.stringify(hObj, null, 2)};\n`;
          code += `headers['Idempotency-Key'] = crypto.randomUUID();\n\n`;
        } else {
          code += `const headers = ${JSON.stringify(hObj, null, 2)};\n\n`;
        }

        code += `const options = {\n  method: '${method}',\n  headers,\n`;
        if (body && method !== 'GET') {
          code += `  body: JSON.stringify(${body.split('\n').map((l, i) => i === 0 ? l : '  ' + l).join('\n')})\n`;
        }
        code += `};\n\n`;

        code += `// Exponential backoff with jitter for network or 5xx errors\n`;
        code += `async function fetchWithRetry(url, options, maxRetries = 3) {\n`;
        code += `  const delays = [500, 1500, 3500];\n`;
        code += `  for (let i = 0; i <= maxRetries; i++) {\n`;
        code += `    try {\n`;
        code += `      const res = await fetch(url, options);\n`;
        code += `      if (res.ok) return await res.json();\n`;
        code += `      if (res.status >= 400 && res.status < 500) {\n`;
        code += `        if (res.status === 409) throw new Error("Idempotency conflict");\n`;
        code += `        throw new Error(\`Client error \${res.status}\`);\n`;
        code += `      }\n`;
        code += `      if (i === maxRetries) throw new Error(\`Server error \${res.status}\`);\n`;
        code += `    } catch (err) {\n`;
        code += `      if (err.message.includes("Client error") || err.message.includes("conflict")) throw err;\n`;
        code += `      if (i === maxRetries) throw err;\n`;
        code += `    }\n`;
        code += `    const jitter = Math.floor(Math.random() * 200);\n`;
        code += `    await new Promise(r => setTimeout(r, delays[i] + jitter));\n`;
        code += `  }\n}\n\n`;
        code += `fetchWithRetry('${url}', options)\n  .then(console.log)\n  .catch(console.error);`;

        return code;
      }
      case 'python': {
        const hObj: Record<string, string> = {};
        headers.filter(h => h.enabled && h.key).forEach(h => { hObj[h.key] = h.value; });
        let code = `import requests\nimport time\nimport random\nimport uuid\n\nheaders = ${JSON.stringify(hObj, null, 4)}\n`;
        
        if (method === 'POST') {
          code += `headers['Idempotency-Key'] = str(uuid.uuid4())\n`;
        }
        
        code += `\n`;
        if (body && method !== 'GET') {
          code += `payload = ${body}\n\n`;
        }
        
        code += `def request_with_retry():\n`;
        code += `    delays = [0.5, 1.5, 3.5]\n`;
        code += `    for i in range(4):\n`;
        code += `        try:\n`;
        if (body && method !== 'GET') {
          code += `            res = requests.${method.toLowerCase()}('${url}', headers=headers, json=payload)\n`;
        } else {
          code += `            res = requests.${method.toLowerCase()}('${url}', headers=headers)\n`;
        }
        code += `            if res.status_code < 400:\n`;
        code += `                return res.json()\n`;
        code += `            if 400 <= res.status_code < 500:\n`;
        code += `                if res.status_code == 409:\n`;
        code += `                    raise Exception("Idempotency conflict")\n`;
        code += `                raise Exception(f"Client error: {res.status_code}")\n`;
        code += `            if i == 3:\n`;
        code += `                raise Exception(f"Server error: {res.status_code}")\n`;
        code += `        except requests.RequestException as e:\n`;
        code += `            if i == 3:\n`;
        code += `                raise e\n`;
        code += `        \n`;
        code += `        jitter = random.uniform(0, 0.2)\n`;
        code += `        time.sleep(delays[i] + jitter)\n\n`;
        code += `print(request_with_retry())\n`;
        
        return code;
      }
      case 'php': {
        let code = `<?php\n\n$ch = curl_init();\n\ncurl_setopt($ch, CURLOPT_URL, '${url}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
        if (method === 'POST') code += `curl_setopt($ch, CURLOPT_POST, true);\n`;
        else if (method !== 'GET') code += `curl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${method}');\n`;
        
        const hArr = headers.filter(h => h.enabled && h.key).map(h => `'${h.key}: ${h.value}'`);
        if (method === 'POST') {
          hArr.push(`'Idempotency-Key: ' . bin2hex(random_bytes(16))`);
        }
        
        if (hArr.length) {
          code += `$headers = [\n    ${hArr.join(',\n    ')}\n];\n`;
          code += `curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);\n`;
        }
        
        if (body && method !== 'GET') code += `curl_setopt($ch, CURLOPT_POSTFIELDS, '${body.replace(/'/g, "\\'")}');\n`;
        
        code += `\n$delays = [500, 1500, 3500];\n`;
        code += `$maxRetries = 3;\n`;
        code += `$attempt = 0;\n\n`;
        code += `while ($attempt <= $maxRetries) {\n`;
        code += `    $response = curl_exec($ch);\n`;
        code += `    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);\n\n`;
        code += `    if ($httpCode >= 200 && $httpCode < 400) {\n`;
        code += `        $data = json_decode($response, true);\n`;
        code += `        print_r($data);\n`;
        code += `        break;\n`;
        code += `    }\n\n`;
        code += `    if ($httpCode >= 400 && $httpCode < 500) {\n`;
        code += `        die("Client Error: " . $httpCode);\n`;
        code += `    }\n\n`;
        code += `    if ($attempt == $maxRetries) {\n`;
        code += `        die("Server Error after retries");\n`;
        code += `    }\n\n`;
        code += `    $jitter = mt_rand(0, 200);\n`;
        code += `    usleep(($delays[$attempt] + $jitter) * 1000);\n`;
        code += `    $attempt++;\n`;
        code += `}\n\ncurl_close($ch);\n`;
        
        return code;
      }
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(generateCode());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const logColors: Record<string, string> = {
    info: 'text-slate-400',
    request: 'text-blue-400',
    response: 'text-green-400',
    error: 'text-red-400',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400">
              <span className="material-symbols-outlined text-[22px]">terminal</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">API Playground</h2>
            <span className="bg-green-500/20 text-green-400 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider border border-green-500/30 uppercase">Live</span>
          </div>
          <p className="text-slate-400 text-sm">Testez les endpoints Kobara en temps réel. Les requêtes sont exécutées sur le serveur.</p>
        </div>
      </div>

      {/* Endpoint Selector */}
      <div className="flex flex-wrap gap-2">
        {ENDPOINTS.map((ep, i) => (
          <button
            key={i}
            onClick={() => handleSelectEndpoint(i)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border ${
              selectedEndpoint === i
                ? 'bg-white/10 border-white/20 text-white shadow-sm'
                : 'bg-white/[0.02] border-white/[0.06] text-slate-400 hover:bg-white/5 hover:text-white hover:border-white/10'
            }`}
          >
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border ${METHOD_COLORS[ep.method]}`}>
              {ep.method}
            </span>
            {ep.label}
          </button>
        ))}
      </div>

      {/* Main 2-col Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── LEFT: Request ── */}
        <div className="bg-[#0F172A] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
          {/* URL Bar */}
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[#0D1321]">
            <div className="flex gap-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as HttpMethod)}
                className={`shrink-0 w-24 rounded-lg px-3 py-2.5 text-xs font-bold tracking-wider border appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500/50 bg-transparent ${METHOD_COLORS[method]}`}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 bg-white/[0.03] border border-[rgba(255,255,255,0.08)] rounded-lg px-4 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/30"
                placeholder="https://kobara.app/api/v1/..."
              />
              <button
                onClick={sendRequest}
                disabled={requestState === 'loading'}
                className={`shrink-0 px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-200 ${
                  requestState === 'loading'
                    ? 'bg-orange-500/50 text-white/70 cursor-wait'
                    : 'bg-orange-500 text-white hover:bg-orange-600 shadow-sm shadow-orange-500/20 active:scale-[0.98]'
                }`}
              >
                {requestState === 'loading' ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Envoi...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">send</span>
                    Send
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Request Tabs */}
          <div className="border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex">
              {([
                { id: 'body' as RequestTab, label: 'Body', icon: 'data_object' },
                { id: 'headers' as RequestTab, label: 'Headers', icon: 'list', badge: headers.filter(h => h.enabled).length },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRequestTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                    requestTab === tab.id
                      ? 'border-orange-500 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className="bg-white/10 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Request Content */}
          <div className="flex-1 p-4 min-h-[300px] max-h-[500px] overflow-auto">
            {requestTab === 'body' && (
              method === 'GET' ? (
                <div className="flex items-center justify-center h-full text-slate-500 text-sm">
                  <div className="text-center">
                    <span className="material-symbols-outlined text-[32px] block mb-2 opacity-40">info</span>
                    Les requêtes GET n&apos;ont pas de body
                  </div>
                </div>
              ) : (
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full h-full min-h-[280px] bg-[#0D1321] border border-[rgba(255,255,255,0.06)] rounded-lg p-4 font-mono text-[13px] text-white/90 leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-orange-500/30 focus:border-orange-500/20 placeholder-slate-600"
                  placeholder='{ "key": "value" }'
                  spellCheck={false}
                />
              )
            )}

            {requestTab === 'headers' && (
              <div className="space-y-2">
                {headers.map((h, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <button
                      onClick={() => toggleHeader(i)}
                      className={`shrink-0 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        h.enabled ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-slate-600'
                      }`}
                    >
                      {h.enabled && <span className="material-symbols-outlined text-[14px]">check</span>}
                    </button>
                    <input
                      value={h.key}
                      onChange={(e) => updateHeader(i, 'key', e.target.value)}
                      placeholder="Header name"
                      className="w-[40%] bg-white/[0.03] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                    />
                    <input
                      value={h.value}
                      onChange={(e) => updateHeader(i, 'value', e.target.value)}
                      placeholder="Value"
                      className="flex-1 bg-white/[0.03] border border-[rgba(255,255,255,0.06)] rounded-lg px-3 py-2 text-sm font-mono text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-orange-500/30"
                    />
                    <button
                      onClick={() => removeHeader(i)}
                      className="shrink-0 opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all"
                    >
                      <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addHeader}
                  className="flex items-center gap-1.5 text-slate-500 hover:text-white text-sm font-medium mt-3 transition-colors"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add header
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Response ── */}
        <div className="bg-[#0F172A] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden flex flex-col">
          {/* Status Bar */}
          <div className="p-4 border-b border-[rgba(255,255,255,0.08)] bg-[#0D1321] flex items-center justify-between min-h-[60px]">
            {requestState === 'idle' && !response && (
              <span className="text-slate-500 text-sm font-medium">En attente d&apos;une requête...</span>
            )}
            {requestState === 'loading' && (
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:0ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:150ms]" />
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-bounce [animation-delay:300ms]" />
                </div>
                <span className="text-orange-400 text-sm font-medium">Envoi de la requête...</span>
              </div>
            )}
            {response && requestState !== 'loading' && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`px-3 py-1 rounded-lg text-xs font-bold border ${getStatusColor(response.status)}`}>
                  {response.status} {response.statusText}
                </span>
                <span className="text-slate-500 text-xs font-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">timer</span>
                  {response.time}ms
                </span>
                <span className="text-slate-500 text-xs font-mono flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">straighten</span>
                  {(new TextEncoder().encode(response.body).length / 1024).toFixed(1)} KB
                </span>
              </div>
            )}
            {response && (
              <button
                onClick={copyResponse}
                className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-medium transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)]"
              >
                <span className="material-symbols-outlined text-[14px]">{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copié!' : 'Copy'}
              </button>
            )}
          </div>

          {/* Response Tabs */}
          <div className="border-b border-[rgba(255,255,255,0.08)]">
            <div className="flex">
              {([
                { id: 'response' as ResponseTab, label: 'Response', icon: 'code' },
                { id: 'headers' as ResponseTab, label: 'Headers', icon: 'list' },
                { id: 'logs' as ResponseTab, label: 'Logs', icon: 'terminal', badge: logs.length || undefined },
              ]).map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setResponseTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                    responseTab === tab.id
                      ? 'border-orange-500 text-white'
                      : 'border-transparent text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                  {tab.badge !== undefined && (
                    <span className="bg-white/10 text-slate-400 px-1.5 py-0.5 rounded text-[10px] font-bold">{tab.badge}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Response Content */}
          <div className="flex-1 min-h-[300px] max-h-[500px] overflow-auto">
            {responseTab === 'response' && (
              <div className="p-4">
                {!response && requestState === 'idle' && (
                  <div className="flex flex-col items-center justify-center h-[260px] text-slate-500">
                    <span className="material-symbols-outlined text-[48px] mb-3 opacity-20">cloud_upload</span>
                    <p className="text-sm font-medium">Cliquez sur &quot;Send&quot; pour voir la réponse</p>
                    <p className="text-xs text-slate-600 mt-1">La réponse de l&apos;API apparaîtra ici</p>
                  </div>
                )}
                {requestState === 'loading' && (
                  <div className="flex flex-col items-center justify-center h-[260px]">
                    <svg className="animate-spin h-8 w-8 text-orange-400 mb-3" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <p className="text-sm text-slate-400 font-medium">En attente de la réponse...</p>
                  </div>
                )}
                {response && requestState !== 'loading' && (
                  <pre className="font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                    <JsonHighlight json={response.body} isError={requestState === 'error'} />
                  </pre>
                )}
              </div>
            )}

            {responseTab === 'headers' && (
              <div className="p-4">
                {response ? (
                  <div className="space-y-1">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="flex gap-3 py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
                        <span className="text-blue-400 font-mono text-[13px] font-medium shrink-0">{key}:</span>
                        <span className="text-white/80 font-mono text-[13px] break-all">{value}</span>
                      </div>
                    ))}
                    {Object.keys(response.headers).length === 0 && (
                      <p className="text-slate-500 text-sm">Aucun header disponible</p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-[260px] text-slate-500 text-sm">
                    Les headers apparaîtront après l&apos;envoi
                  </div>
                )}
              </div>
            )}

            {responseTab === 'logs' && (
              <div className="p-4 font-mono text-[12px] space-y-1">
                {logs.length === 0 ? (
                  <div className="flex items-center justify-center h-[260px] text-slate-500 text-sm font-sans">
                    Les logs apparaîtront ici
                  </div>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="flex gap-3 py-0.5">
                      <span className="text-slate-600 shrink-0">{log.timestamp}</span>
                      <span className={`shrink-0 uppercase text-[10px] font-bold tracking-wider mt-0.5 ${logColors[log.type]}`}>{log.type}</span>
                      <span className={`break-all ${logColors[log.type]}`}>{log.message}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Code Generation ── */}
      <div className="bg-[#0F172A] rounded-2xl border border-[rgba(255,255,255,0.08)] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.08)] bg-[#0D1321]">
          <div className="flex">
            {(['curl', 'javascript', 'python', 'php'] as CodeTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setCodeTab(tab)}
                className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
                  codeTab === tab ? 'border-orange-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'curl' ? 'cURL' : tab === 'javascript' ? 'JavaScript' : tab === 'python' ? 'Python' : 'PHP'}
              </button>
            ))}
          </div>
          <button
            onClick={copyCode}
            className="flex items-center gap-1.5 text-slate-500 hover:text-white text-xs font-medium transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-[rgba(255,255,255,0.06)] mr-3"
          >
            <span className="material-symbols-outlined text-[14px]">{copiedCode ? 'check' : 'content_copy'}</span>
            {copiedCode ? 'Copié!' : 'Copy'}
          </button>
        </div>
        <div className="p-4 bg-[#0B1120] max-h-[400px] overflow-auto">
          <pre className="font-mono text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap">{generateCode()}</pre>
        </div>
      </div>
    </div>
  );
}

// ── JSON Syntax Highlighter ──
function JsonHighlight({ json, isError }: { json: string; isError: boolean }) {
  try {
    const parts = json.split(/("(?:[^"\\]|\\.)*")\s*(?=:)|:\s*("(?:[^"\\]|\\.)*")|:\s*(true|false)|:\s*(\d+\.?\d*)|:\s*(null)/g);
    return (
      <>
        {parts.map((part, i) => {
          if (!part) return null;
          // Keys (followed by colon)
          if (i > 0 && parts[i - 1] === undefined && part.startsWith('"') && json.includes(part + ':')) {
            return <span key={i} className="text-[#7dd3fc]">{part}</span>;
          }
          // String values
          if (part.startsWith('"')) {
            return <span key={i} className={isError ? 'text-red-300' : 'text-[#86efac]'}>{part}</span>;
          }
          if (part === 'true' || part === 'false') {
            return <span key={i} className="text-[#c4b5fd]">{part}</span>;
          }
          if (part === 'null') {
            return <span key={i} className="text-slate-500">{part}</span>;
          }
          if (/^\d+\.?\d*$/.test(part)) {
            return <span key={i} className="text-[#fbbf24]">{part}</span>;
          }
          return <span key={i} className="text-white/80">{part}</span>;
        })}
      </>
    );
  } catch {
    return <span className="text-white/80">{json}</span>;
  }
}
