// --- KILL SWITCH ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()));
}

// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbxLAyqH_m33NSQi3TCzW0DR-gGQYWvXlGfngTnaVn_V5zYGUnpg17JzYxidgNc2v2TD/exec"; 

// --- STATE ---
let storedKey = localStorage.getItem('ide_key');
let geminiKey = localStorage.getItem('ide_gemini_key');
let currentProject = null;
let files = { gs: '', html: '' };
let activeTab = 'gs';
let isAIViewOpen = false;

// --- INIT ---
window.onload = () => {
    if ('serviceWorker' in navigator) document.getElementById('updateBtn').classList.remove('hidden');
    if (geminiKey) document.getElementById('geminiKeyInput').value = geminiKey; // visual only
    
    if (storedKey) {
        nav('dashboard');
        loadProjects();
    } else {
        nav('login');
    }
}

// --- AI CHAT LOGIC ---
function saveGeminiKey() {
    const key = document.getElementById('geminiKeyInput').value.trim();
    if(!key) return alert("Enter Key");
    geminiKey = key;
    localStorage.setItem('ide_gemini_key', key);
    alert("API Key Saved!");
}

async function sendAI() {
    if(!geminiKey) return alert("Please set Gemini API Key in Dashboard first.");
    const input = document.getElementById('aiInput');
    const prompt = input.value.trim();
    if(!prompt) return;

    // Add User Message
    addChatMessage("User", prompt);
    input.value = "";

    try {
        // Show typing indicator
        const loadingId = addChatMessage("System", "Thinking...");
        
        // Call Backend
        const responseText = await api('AI_CHAT', { prompt: prompt, apiKey: geminiKey });
        
        // Remove typing, Add AI Message
        document.getElementById(loadingId).remove();
        addChatMessage("Gemini", responseText, true); // True = Enable Copy
    } catch(e) {
        addChatMessage("Error", e.message);
    }
}

function addChatMessage(sender, text, isCode = false) {
    const history = document.getElementById('chatHistory');
    const id = "msg-" + Date.now();
    
    let content = text.replace(/\n/g, '<br>');
    if (isCode) {
        // Simple heuristic to wrap code blocks
        content = `<div class="bg-gray-100 dark:bg-gray-900 p-2 rounded border dark:border-gray-700 my-1 whitespace-pre-wrap select-all font-mono text-[10px]">${text}</div>`;
        content += `<button onclick="insertCodeFromChat(this)" class="text-[10px] text-blue-500 underline mt-1">Insert at Cursor</button>`;
    }

    const div = document.createElement('div');
    div.id = id;
    div.className = "mb-2 pb-2 border-b border-gray-100 dark:border-gray-800 last:border-0";
    div.innerHTML = `<strong class="text-purple-600 dark:text-purple-400 block mb-1">${sender}:</strong> <div class="text-gray-700 dark:text-gray-300">${content}</div>`;
    
    history.appendChild(div);
    history.scrollTop = history.scrollHeight;
    return id;
}

function insertCodeFromChat(btn) {
    const codeDiv = btn.previousElementSibling;
    const code = codeDiv.innerText;
    const editor = document.getElementById('editor');
    
    // Insert at cursor logic
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end, text.length);
    
    editor.value = before + code + after;
    files[activeTab] = editor.value;
    
    // Toggle back to full view to see code
    if(isAIViewOpen) toggleAI();
}

function handleAIKey(e) { if(e.key === 'Enter') sendAI(); }


// --- AUTH ---
function login() {
    const input = document.getElementById('accessKeyInput');
    const errorMsg = document.getElementById('loginError');
    const key = input.value.trim();
    errorMsg.classList.add('hidden');
    input.classList.remove('border-red-500');

    if (!key) { showLoginError(); return; }
    storedKey = key;
    
    loading(true);
    api('GET_PROJECTS')
        .then(data => {
            loading(false);
            localStorage.setItem('ide_key', key);
            nav('dashboard');
            renderProjects(data);
        })
        .catch(err => {
            loading(false);
            if(err.message.includes("Wrong Password")) showLoginError();
            else alert("Error: " + err.message);
        });
}

function showLoginError() {
    const input = document.getElementById('accessKeyInput');
    document.getElementById('loginError').classList.remove('hidden');
    input.classList.add('border-red-500');
    input.classList.add('animate-pulse');
    setTimeout(() => input.classList.remove('animate-pulse'), 500);
}

function handleLoginKey(e) { if (e.key === 'Enter') login(); }
function togglePassword(id, btn) {
    const el = document.getElementById(id);
    el.type = el.type === 'password' ? 'text' : 'password';
}
function logout() { localStorage.removeItem('ide_key'); location.reload(); }

// --- NAV ---
function nav(view) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.getElementById('logoutBtn').classList.toggle('hidden', view === 'login');
}

function toggleAI() {
    const codeBox = document.getElementById('codeContainer');
    const aiBox = document.getElementById('aiContainer');
    const btn = document.getElementById('aiToggleBtn');
    isAIViewOpen = !isAIViewOpen;
    
    if (isAIViewOpen) {
        codeBox.classList.replace('h-full', 'h-half');
        aiBox.classList.replace('h-0', 'h-half');
        btn.classList.add('bg-purple-600', 'text-white');
    } else {
        codeBox.classList.replace('h-half', 'h-full');
        aiBox.classList.replace('h-half', 'h-0');
        btn.classList.remove('bg-purple-600', 'text-white');
    }
}

function setTab(tab) {
    files[activeTab] = document.getElementById('editor').value;
    activeTab = tab;
    document.getElementById('editor').value = files[activeTab] || '';
    
    const tGs = document.getElementById('tab-gs');
    const tHtml = document.getElementById('tab-html');
    const active = "border-blue-600 text-blue-600";
    const inactive = "text-gray-400 border-transparent";
    
    if (tab === 'gs') {
        tGs.className = `flex-1 py-3 border-b-2 ${active}`;
        tHtml.className = `flex-1 py-3 border-b-2 ${inactive}`;
    } else {
        tHtml.className = `flex-1 py-3 border-b-2 ${active}`;
        tGs.className = `flex-1 py-3 border-b-2 ${inactive}`;
    }
}

// --- API ---
async function api(action, payload = {}) {
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, accessKey: storedKey, ...payload })
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } 
    catch (err) { throw new Error("Server Error (HTML Response)"); }
    if (!json.success) throw new Error(json.error || "Unknown Error");
    return json.data;
}

// --- UTILS ---
function encode64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) { return String.fromCharCode('0x' + p1); }));
}
function loading(show) { document.getElementById('loader').classList.toggle('hidden', !show); }

// --- CORE ---
async function loadProjects() {
    loading(true);
    try { renderProjects(await api('GET_PROJECTS')); } 
    catch(e) { if(!e.message.includes("Wrong Password")) alert(e.message); } 
    finally { loading(false); }
}

function renderProjects(list) {
    const container = document.getElementById('projectList');
    if(list.length === 0) return container.innerHTML = `<div class="text-center text-gray-400 mt-10">No projects yet.<br>Click + to create one.</div>`;
    
    container.innerHTML = list.map(p => `
        <div onclick="openProject('${p.id}', '${p.name}', '${p.scriptId}')" class="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 mb-3 active:scale-95 transition-transform relative overflow-hidden group">
            <div class="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
            <h3 class="font-bold text-lg">${p.name}</h3>
            <p class="text-xs text-gray-500 mb-3">Updated: ${new Date(p.updated).toLocaleDateString()}</p>
            ${p.url ? `<a href="${p.url}" target="_blank" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-3 py-1.5 rounded-lg text-xs font-bold">🚀 Launch App</a>` : ''}
        </div>`).join('');
}

async function createProject() {
    const name = prompt("Project Name:");
    if (!name) return;
    loading(true);
    const res = await api('CREATE_PROJECT', { name: name });
    loading(false);
    openProject(res.id, res.name, res.scriptId, res.files);
}

async function openProject(id, name, scriptId, existingFiles = null) {
    currentProject = { id: id, name: name, scriptId: scriptId };
    nav('editor'); 
    if(isAIViewOpen) toggleAI(); 

    if (existingFiles) {
        files = existingFiles;
        document.getElementById('editor').value = files[activeTab];
    } else {
        files = { gs: '// Fetching...', html: '<!-- Fetching... -->' };
        document.getElementById('editor').value = files[activeTab];
        loading(true);
        try {
            files = await api('GET_FILES', { scriptId: scriptId });
            document.getElementById('editor').value = files[activeTab];
        } catch(e) { document.getElementById('editor').value = "// Error."; }
        finally { loading(false); }
    }
}

async function deleteCurrentProject() {
    if(!currentProject) return;
    if(prompt(`Type "DELETE" to remove this project:`) !== "DELETE") return;
    loading(true);
    await api('DELETE_PROJECT', { id: currentProject.id });
    loading(false);
    currentProject = null;
    nav('dashboard');
    loadProjects();
}

async function save() {
    loading(true);
    files[activeTab] = document.getElementById('editor').value;
    await api('SAVE_PROJECT', { id: currentProject.id, files: { gs: encode64(files.gs), html: encode64(files.html) } });
    loading(false);
}

async function deploy() {
    files[activeTab] = document.getElementById('editor').value;
    if(!confirm("Deploy? (~30s)")) return;
    loading(true);
    const res = await api('DEPLOY_PROJECT', { id: currentProject.id, files: { gs: encode64(files.gs), html: encode64(files.html) } });
    loading(false);
    loadProjects();
    if (confirm("Deployment Successful! Open App?")) window.open(res.appUrl, '_blank');
}

async function pasteCode() { try { document.getElementById('editor').value = await navigator.clipboard.readText(); files[activeTab] = document.getElementById('editor').value; } catch(e) { alert("Use Manual Paste"); } }
function copyCode() { navigator.clipboard.writeText(document.getElementById('editor').value); }

async function forceUpdate() {
    if(!confirm("Update App?")) return;
    loading(true);
    if ('serviceWorker' in navigator) (await navigator.serviceWorker.getRegistrations()).forEach(r => r.unregister());
    if ('caches' in window) (await caches.keys()).forEach(k => caches.delete(k));
    window.location.reload(true);
}

const themeBtn = document.getElementById('themeBtn');
themeBtn.onclick = () => { document.documentElement.classList.toggle('dark'); localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); };
if (localStorage.theme === 'dark') document.documentElement.classList.add('dark');
