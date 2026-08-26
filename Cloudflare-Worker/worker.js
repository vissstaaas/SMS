/**
 * Cloudflare Worker: SMS Forwarder Center + D1 Database
 * 专为 Cloudflare Workers + D1 打造的无服务器私人接码平台
 */

const HTML_DASHBOARD = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SMS Center - Cloudflare 云端私人接码平台</title>
  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Lucide Icons -->
  <script src="https://unpkg.com/lucide@latest"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; }
    .glass { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(12px); }
  </style>
</head>
<body class="bg-slate-50 text-slate-800 min-h-screen">
  
  <!-- Navigation / Header -->
  <header class="sticky top-0 z-30 border-b border-slate-200 glass">
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <div class="flex items-center space-x-3">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20">
          <i data-lucide="cloud" class="w-5 h-5"></i>
        </div>
        <div>
          <h1 class="font-bold text-lg leading-none text-slate-900">SMS Center <span class="text-xs font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-700 ml-1">Cloudflare D1</span></h1>
          <span class="text-xs font-medium text-emerald-600 flex items-center gap-1 mt-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> 24H 全天候云端运行
          </span>
        </div>
      </div>

      <div class="flex items-center gap-2 sm:gap-3">
        <!-- Webhook Helper Button -->
        <button onclick="openWebhookModal()" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition shadow-sm">
          <i data-lucide="link" class="w-4 h-4 text-blue-500"></i>
          <span>推送链接</span>
        </button>

        <!-- Clear All Button -->
        <button onclick="confirmClearAll()" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 transition border border-rose-200/60">
          <i data-lucide="trash-2" class="w-4 h-4"></i>
          <span class="hidden sm:inline">清空记录</span>
        </button>
      </div>
    </div>
  </header>

  <!-- Main Container -->
  <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    
    <!-- Filter & Search Card -->
    <div class="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200/80 mb-6">
      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">来源设备</label>
          <select id="filterDevice" onchange="loadSms(1)" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
            <option value="">全部设备</option>
          </select>
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">发送号码</label>
          <input type="text" id="filterPhone" placeholder="搜索号码..." oninput="debounceLoad()" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">内容关键字</label>
          <input type="text" id="filterQuery" placeholder="搜索短信内容..." oninput="debounceLoad()" class="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
        </div>
        <div class="flex items-end gap-2">
          <button onclick="loadSms(1)" class="flex-1 inline-flex items-center justify-center gap-1.5 bg-orange-600 hover:bg-orange-700 text-white font-medium px-4 py-2 rounded-xl text-sm transition shadow-sm shadow-orange-500/20">
            <i data-lucide="refresh-cw" class="w-4 h-4" id="refreshIcon"></i>
            <span>刷新</span>
          </button>
          <button onclick="resetFilters()" class="px-3 py-2 text-sm font-medium rounded-xl text-slate-500 bg-slate-100 hover:bg-slate-200 transition">
            重置
          </button>
        </div>
      </div>
      
      <!-- Auto Refresh Switch -->
      <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div class="flex items-center gap-2">
          <input type="checkbox" id="autoRefresh" checked class="w-3.5 h-3.5 text-orange-600 rounded border-slate-300 focus:ring-orange-500">
          <label for="autoRefresh" class="cursor-pointer select-none">每 5 秒自动同步云端短信</label>
        </div>
        <div id="statusInfo" class="font-medium text-slate-400">正在同步...</div>
      </div>
    </div>

    <!-- SMS List Cards -->
    <div id="smsContainer" class="space-y-4">
      <div class="bg-white rounded-2xl p-6 border border-slate-200/80 animate-pulse flex flex-col gap-3">
        <div class="h-4 bg-slate-200 rounded w-1/4"></div>
        <div class="h-10 bg-slate-100 rounded w-full"></div>
        <div class="h-4 bg-slate-200 rounded w-1/2"></div>
      </div>
    </div>

    <!-- Pagination -->
    <div id="pagination" class="mt-6 flex items-center justify-between"></div>
  </main>

  <!-- Webhook URL Modal -->
  <div id="webhookModal" class="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm hidden flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-100 relative">
      <button onclick="closeWebhookModal()" class="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
        <i data-lucide="x" class="w-5 h-5"></i>
      </button>
      <div class="flex items-center gap-3 mb-4">
        <div class="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <i data-lucide="radio" class="w-5 h-5"></i>
        </div>
        <div>
          <h3 class="text-base font-bold text-slate-900">云端 Webhook 推送地址</h3>
          <p class="text-xs text-slate-500">填入 iPhone 快捷指令或安卓 SmsForwarder</p>
        </div>
      </div>
      
      <div class="space-y-3 text-sm">
        <div>
          <label class="block text-xs font-semibold text-slate-600 mb-1">接口地址 (URL)</label>
          <div class="flex rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            <input type="text" id="webhookUrlInput" readonly class="px-3 py-2 text-xs font-mono text-slate-700 bg-transparent flex-1 focus:outline-none" value="">
            <button onclick="copyWebhookUrl()" class="px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition flex items-center gap-1">
              <i data-lucide="copy" class="w-3.5 h-3.5"></i> 复制
            </button>
          </div>
        </div>

        <div class="bg-emerald-50 rounded-xl p-3.5 text-xs text-emerald-800 space-y-1.5 border border-emerald-200/60">
          <div class="font-semibold flex items-center gap-1">
            <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> 全球公网直连优势
          </div>
          <p>• 本地址已自带全球顶级公网 HTTPS，无需内网穿透。</p>
          <p>• 家中手机使用 WiFi 或流量均可直接推送上报。</p>
          <p>• 电脑关机后，云端照常接收存储，随开随查。</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Toast Notification -->
  <div id="toast" class="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 transform translate-y-16 opacity-0 transition duration-300">
    <i data-lucide="check-circle" class="w-4 h-4 text-emerald-400"></i>
    <span id="toastMsg">复制成功</span>
  </div>

  <script>
    let currentPage = 1;
    let debounceTimer = null;

    document.addEventListener('DOMContentLoaded', () => {
      lucide.createIcons();
      loadDevices();
      loadSms(1);
      setupAutoRefresh();
      updateWebhookUrl();
    });

    function showToast(msg) {
      const toast = document.getElementById('toast');
      const toastMsg = document.getElementById('toastMsg');
      toastMsg.innerText = msg;
      toast.classList.remove('translate-y-16', 'opacity-0');
      setTimeout(() => {
        toast.classList.add('translate-y-16', 'opacity-0');
      }, 2000);
    }

    function copyToClipboard(text, label = '验证码') {
      navigator.clipboard.writeText(text).then(() => {
        showToast(\`\${label} [\${text}] 已复制到剪贴板！\`);
      }).catch(err => {
        alert('复制失败，请手动复制: ' + text);
      });
    }

    function debounceLoad() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { loadSms(1); }, 300);
    }

    async function loadDevices() {
      try {
        const res = await fetch('/api/sms/devices');
        const data = await res.json();
        const select = document.getElementById('filterDevice');
        const current = select.value;
        select.innerHTML = '<option value="">全部设备</option>' + data.map(d => \`<option value="\${d}" \${d === current ? 'selected':''}>\${d}</option>\`).join('');
      } catch (e) { console.error(e); }
    }

    async function loadSms(page = 1) {
      currentPage = page;
      const device = document.getElementById('filterDevice').value;
      const phone = document.getElementById('filterPhone').value;
      const query = document.getElementById('filterQuery').value;
      
      const refreshIcon = document.getElementById('refreshIcon');
      if (refreshIcon) refreshIcon.classList.add('animate-spin');

      try {
        const url = \`/api/sms/list?page=\${page}&per_page=15&device=\${encodeURIComponent(device)}&phone=\${encodeURIComponent(phone)}&query=\${encodeURIComponent(query)}\`;
        const res = await fetch(url);
        const data = await res.json();
        renderSmsList(data);
        renderPagination(data);
        document.getElementById('statusInfo').innerText = \`共 \${data.total} 条记录，第 \${data.page} / \${data.pages} 页\`;
      } catch (err) {
        document.getElementById('statusInfo').innerText = '同步数据失败';
      } finally {
        if (refreshIcon) refreshIcon.classList.remove('animate-spin');
      }
    }

    function renderSmsList(data) {
      const container = document.getElementById('smsContainer');
      if (!data.items || data.items.length === 0) {
        container.innerHTML = \`
          <div class="bg-white rounded-2xl p-12 text-center border border-slate-200/80">
            <div class="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
              <i data-lucide="inbox" class="w-6 h-6"></i>
            </div>
            <h3 class="text-base font-semibold text-slate-800 mb-1">云端暂无短信记录</h3>
            <p class="text-xs text-slate-500">当手机向本 Cloudflare Worker 发送短信时，将实时呈现在这里。</p>
          </div>
        \`;
        lucide.createIcons();
        return;
      }

      container.innerHTML = data.items.map(item => {
        const hasCode = item.code && item.code.trim().length > 0;
        return \`
          <div class="bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-orange-200 transition shadow-sm hover:shadow-md">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-orange-50 text-orange-700">
                  <i data-lucide="phone-incoming" class="w-3.5 h-3.5"></i>
                  \${item.phone || '未知号码'}
                </span>
                \${item.device ? \`<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600"><i data-lucide="smartphone" class="w-3 h-3"></i>\${item.device}</span>\` : ''}
              </div>
              <span class="text-xs text-slate-400 font-mono flex items-center gap-1">
                <i data-lucide="clock" class="w-3.5 h-3.5"></i>
                \${item.received_at}
              </span>
            </div>

            \${hasCode ? \`
              <div class="mb-3.5 p-3 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50/60 border border-orange-100/80 flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-orange-800">提取到的验证码:</span>
                  <span class="text-xl font-bold font-mono tracking-wider text-orange-600 bg-white px-2.5 py-0.5 rounded-lg border border-orange-200/60 shadow-sm">\${item.code}</span>
                </div>
                <button onclick="copyToClipboard('\${item.code}', '验证码')" class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold transition shadow-sm shadow-orange-500/20 active:scale-95">
                  <i data-lucide="copy" class="w-3.5 h-3.5"></i>
                  <span>一键复制</span>
                </button>
              </div>
            \` : ''}

            <div class="text-sm text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
              \${formatContent(item.content)}
            </div>
          </div>
        \`;
      }).join('');
      
      lucide.createIcons();
    }

    function formatContent(text) {
      if (!text) return '';
      let escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const urlRegex = /(https?:\\/\\/[^\\s]+)/g;
      escaped = escaped.replace(urlRegex, url => \`<a href="\${url}" target="_blank" class="text-orange-600 underline font-medium hover:text-orange-800">\${url}</a>\`);
      return escaped.replace(/\\n/g, '<br>');
    }

    function renderPagination(data) {
      const pag = document.getElementById('pagination');
      if (data.pages <= 1) { pag.innerHTML = ''; return; }
      
      pag.innerHTML = \`
        <button onclick="loadSms(\${data.page - 1})" \${data.page <= 1 ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">上一页</button>
        <span class="text-xs text-slate-500 font-medium">第 \${data.page} / \${data.pages} 页</span>
        <button onclick="loadSms(\${data.page + 1})" \${data.page >= data.pages ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition">下一页</button>
      \`;
    }

    function resetFilters() {
      document.getElementById('filterDevice').value = '';
      document.getElementById('filterPhone').value = '';
      document.getElementById('filterQuery').value = '';
      loadSms(1);
    }

    function setupAutoRefresh() {
      setInterval(() => {
        const checkbox = document.getElementById('autoRefresh');
        if (checkbox && checkbox.checked) {
          loadSms(currentPage);
          loadDevices();
        }
      }, 5000);
    }

    async function confirmClearAll() {
      if (!confirm('确定要清空 Cloudflare D1 中的所有短信记录吗？此操作无法撤销。')) return;
      try {
        const res = await fetch('/api/sms/clear', { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
          showToast('云端短信记录已全部清空');
          loadSms(1);
          loadDevices();
        }
      } catch (e) { alert('清空失败: ' + e); }
    }

    function openWebhookModal() { document.getElementById('webhookModal').classList.remove('hidden'); }
    function closeWebhookModal() { document.getElementById('webhookModal').classList.add('hidden'); }
    function updateWebhookUrl() {
      const url = \`\${window.location.origin}/api/sms/receive?token=default_secret_token\`;
      document.getElementById('webhookUrlInput').value = url;
    }
    function copyWebhookUrl() {
      const input = document.getElementById('webhookUrlInput');
      copyToClipboard(input.value, 'Webhook URL');
    }
  </script>
</body>
</html>`;

/**
 * 智能验证码提取
 */
function extractCode(text) {
  if (!text) return null;
  const kwPatterns = [
    /(?:验证码|校验码|动态码|code|otp|PIN)[^\d]*?([0-9]{4,8})/i,
    /([0-9]{4,8})[^\d]*?(?:为您的验证码|是您的验证码|为本次验证码)/i,
    /【.*?】.*?([0-9]{4,8})/
  ];
  for (const p of kwPatterns) {
    const match = text.match(p);
    if (match) return match[1];
  }
  const match = text.match(/\b\d{4,8}\b/) || text.match(/\d{4,8}/);
  return match ? match[0] : null;
}

/**
 * 规范化北京时间 (UTC+8)
 */
function getBeijingTime(timestamp) {
  let date;
  if (timestamp) {
    let t = Number(timestamp);
    if (!isNaN(t)) {
      if (t < 2000000000) t = t * 1000;
      date = new Date(t);
    } else {
      date = new Date(timestamp);
    }
  } else {
    date = new Date();
  }
  if (isNaN(date.getTime())) date = new Date();
  
  // Convert to UTC+8
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const beijing = new Date(utc + (3600000 * 8));
  
  const pad = (n) => String(n).padStart(2, '0');
  return \`\${beijing.getFullYear()}-\${pad(beijing.getMonth() + 1)}-\${pad(beijing.getDate())} \${pad(beijing.getHours())}:\${pad(beijing.getMinutes())}:\${pad(beijing.getSeconds())}\`;
}

function pickField(data, aliases, defaultValue = "") {
  for (const k of aliases) {
    if (data[k] !== undefined && data[k] !== null && String(data[k]).trim() !== "") {
      return String(data[k]).trim();
    }
  }
  return defaultValue;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method.toUpperCase();

    // 1. 初始化数据库表（如果不存在）
    if (env.DB) {
      await env.DB.prepare(\`
        CREATE TABLE IF NOT EXISTS sms_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          phone TEXT NOT NULL,
          content TEXT NOT NULL,
          code TEXT,
          received_at TEXT NOT NULL,
          device TEXT DEFAULT ''
        )
      \`).run();
    } else {
      return new Response("Error: Cloudflare D1 database binding 'DB' is missing. Please bind D1 in Worker settings.", { status: 500 });
    }

    // 2. 首页展示 Web 仪表盘
    if (url.pathname === "/" && method === "GET") {
      return new Response(HTML_DASHBOARD, {
        headers: { "Content-Type": "text/html; charset=utf-8" }
      });
    }

    // 3. 接收短信 API (/api/sms/receive 或兼容 /api_sms_receive.php)
    if ((url.pathname === "/api/sms/receive" || url.pathname === "/api_sms_receive.php") && method === "POST") {
      let data = {};
      const ct = request.headers.get("content-type") || "";

      if (ct.includes("application/json")) {
        try {
          data = await request.json();
        } catch (e) {
          data = {};
        }
      } else {
        try {
          const form = await request.formData();
          for (const [key, value] of form.entries()) {
            data[key] = value;
          }
        } catch (e) {
          data = {};
        }
      }

      // Token 验证 (可通过环境变量 TOKEN 配置自定义 token，默认为 default_secret_token)
      const validToken = env.TOKEN || "default_secret_token";
      const reqToken = url.searchParams.get("token") || data.token || request.headers.get("x-token");

      if (!reqToken || reqToken !== validToken) {
        return Response.json({ success: false, error: "Invalid or missing token" }, { status: 403 });
      }

      const phone = pickField(data, ["phone", "sender", "from", "mobile", "msisdn"]);
      const content = pickField(data, ["content", "text", "message", "body", "msg"]);
      const timeVal = pickField(data, ["time", "timestamp", "receive_time", "received_at", "date", "datetime"]);
      const device = pickField(data, ["device", "sim", "sim_slot", "sim_name", "device_name"]);

      if (!phone || !content) {
        return Response.json({ success: false, error: "Missing required fields (phone and content are required)", received_data: data }, { status: 400 });
      }

      const code = extractCode(content);
      const receivedAt = getBeijingTime(timeVal);

      const result = await env.DB.prepare(
        "INSERT INTO sms_records (phone, content, code, received_at, device) VALUES (?, ?, ?, ?, ?)"
      ).bind(phone, content, code, receivedAt, device).run();

      return Response.json({ success: true, id: result.meta?.last_row_id });
    }

    // 4. 获取短信列表 API
    if (url.pathname === "/api/sms/list" && method === "GET") {
      const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
      const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get("per_page") || "20")));
      const device = url.searchParams.get("device") || "";
      const phone = url.searchParams.get("phone") || "";
      const query = url.searchParams.get("query") || "";

      let whereClauses = [];
      let bindArgs = [];

      if (device) {
        whereClauses.push("device = ?");
        bindArgs.push(device);
      }
      if (phone) {
        whereClauses.push("phone LIKE ?");
        bindArgs.push(\`%\${phone}%\`);
      }
      if (query) {
        whereClauses.push("content LIKE ?");
        bindArgs.push(\`%\${query}%\`);
      }

      const whereSql = whereClauses.length > 0 ? "WHERE " + whereClauses.join(" AND ") : "";

      // 查询总数
      const countRes = await env.DB.prepare(\`SELECT COUNT(*) as total FROM sms_records \${whereSql}\`).bind(...bindArgs).first();
      const total = countRes ? countRes.total : 0;

      // 分页查询
      const offset = (page - 1) * perPage;
      const itemsRes = await env.DB.prepare(\`
        SELECT * FROM sms_records \${whereSql} ORDER BY id DESC LIMIT ? OFFSET ?
      \`).bind(...bindArgs, perPage, offset).all();

      return Response.json({
        total,
        page,
        per_page: perPage,
        pages: total > 0 ? Math.ceil(total / perPage) : 1,
        items: itemsRes.results || []
      });
    }

    // 5. 获取所有设备列表 API
    if (url.pathname === "/api/sms/devices" && method === "GET") {
      const rows = await env.DB.prepare("SELECT DISTINCT device FROM sms_records WHERE device != '' ORDER BY device ASC").all();
      return Response.json((rows.results || []).map(r => r.device));
    }

    // 6. 清空短信记录 API
    if (url.pathname === "/api/sms/clear" && method === "DELETE") {
      await env.DB.prepare("DELETE FROM sms_records").run();
      return Response.json({ success: true });
    }

    return new Response("Not Found", { status: 404 });
  }
};
