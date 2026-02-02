// --- KILL SWITCH FOR STUCK SERVICE WORKERS ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) registration.unregister();
    });
}

// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbxLAyqH_m33NSQi3TCzW0DR-gGQYWvXlGfngTnaVn_V5zYGUnpg17JzYxidgNc2v2TD/exec"; 

// --- STATE MANAGEMENT ---
let storedKey = localStorage.getItem('ide_key');
let currentProject = null;
let files = { gs: '', html: '' };
let activeTab = 'gs';
let isAIViewOpen = false; // State for Split Screen

// --- INITIALIZATION ---
window.onload = () => {
    // Show Update Button if Service Worker is ready
    if ('serviceWorker' in navigator) {
        document.getElementById('updateBtn').classList.remove('hidden');
    }

    if (storedKey) {
        nav('dashboard');
        loadProjects();
    } else {
        nav('login');
    }
}

// --- AUTHENTICATION ENHANCEMENTS ---

function login() {
    const input = document.getElementById('accessKeyInput');
    const errorMsg = document.getElementById('loginError');
    const key = input.value.trim();

    // Reset error state
    errorMsg.classList.add('hidden');
    input.classList.remove('border-red-500', 'ring-2', 'ring-red-500');

    if (!key) {
        showLoginError();
        return;
    }

    storedKey = key;
    // We attempt to load projects. If the API returns "Wrong Password", the api() function handles the logout/error.
    // However, to give immediate feedback if the password logic is handled by API response:
    loading(true);
    // Optimistically try to fetch
    api('GET_PROJECTS')
        .then(data => {
            // Success
            loading(false);
            localStorage.setItem('ide_key', key);
            nav('dashboard');
            renderProjects(data);
        })
        .catch(err => {
            loading(false);
            if(err.message.includes("Wrong Password")) {
                showLoginError();
            } else {
                alert("Connection Error: " + err.message);
            }
        });
}

function showLoginError() {
    const input = document.getElementById('accessKeyInput');
    const errorMsg = document.getElementById('loginError');
    
    errorMsg.classList.remove('hidden');
    input.classList.add('border-red-500', 'ring-2', 'ring-red-500');
    // Shake animation effect
    input.classList.add('animate-pulse');
    setTimeout(() => input.classList.remove('animate-pulse'), 500);
}

// Handle "Enter" Key
function handleLoginKey(event) {
    if (event.key === 'Enter') {
        login();
    }
}

// Toggle Password Visibility
function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
        btn.classList.add('text-blue-600'); // Highlight active state
    } else {
        input.type = 'password';
        btn.classList.remove('text-blue-600');
    }
}

function logout() {
    localStorage.removeItem('ide_key');
    location.reload();
}

// --- NAVIGATION & UI ---
function nav(view) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    document.getElementById('logoutBtn').classList.toggle('hidden', view === 'login');
}

// --- SPLIT SCREEN LOGIC ---
function toggleAI() {
    const codeBox = document.getElementById('codeContainer');
    const aiBox = document.getElementById('aiContainer');
    const btn = document.getElementById('aiToggleBtn');
    
    isAIViewOpen = !isAIViewOpen;
    
    if (isAIViewOpen) {
        // Open Split View
        codeBox.classList.remove('h-full');
        codeBox.classList.add('h-half');
        
        aiBox.classList.remove('h-0');
        aiBox.classList.add('h-half');
        
        btn.classList.add('bg-purple-600', 'text-white');
        btn.classList.remove('bg-purple-100', 'text-purple-600');
    } else {
        // Close AI View (Full Code)
        codeBox.classList.remove('h-half');
        codeBox.classList.add('h-full');
        
        aiBox.classList.remove('h-half');
        aiBox.classList.add('h-0');
        
        btn.classList.remove('bg-purple-600', 'text-white');
        btn.classList.add('bg-purple-100', 'text-purple-600');
    }
}

function setTab(tab) {
    files[activeTab] = document.getElementById('editor').value;
    activeTab = tab;
    document.getElementById('editor').value = files[activeTab] || '';
    
    const tGs = document.getElementById('tab-gs');
    const tHtml = document.getElementById('tab-html');
    const activeClass = "border-blue-600 text-blue-600";
    const inactiveClass = "text-gray-400 border-transparent";
    
    if (tab === 'gs') {
        tGs.className = `flex-1 py-3 border-b-2 ${activeClass}`;
        tHtml.className = `flex-1 py-3 border-b-2 ${inactiveClass}`;
    } else {
        tHtml.className = `flex-1 py-3 border-b-2 ${activeClass}`;
        tGs.className = `flex-1 py-3 border-b-2 ${inactiveClass}`;
    }
}

// --- API CLIENT ---
async function api(action, payload = {}) {
    // Note: loading() is handled by caller mostly, but strictly for API calls:
    const res = await fetch(API_URL, {
        method: 'POST',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: action, accessKey: storedKey, ...payload })
    });

    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } 
    catch (err) { throw new Error("Server returned HTML (Error) instead of JSON."); }

    if (!json.success) {
        if(json.error && json.error.includes("Wrong Password")) {
             // Let the caller handle UI, or force logout if deep in app
             if(action !== 'GET_PROJECTS') logout(); 
             throw new Error("Wrong Password");
        }
        throw new Error(json.error || "Unknown Error");
    }
    return json.data;
}

// --- CORE LOGIC ---
async function loadProjects() {
    loading(true);
    try {
        const data = await api('GET_PROJECTS');
        renderProjects(data);
    } catch(e) {
        if(!e.message.includes("Wrong Password")) alert(e.message);
    } finally {
        loading(false);
    }
}

function renderProjects(list) {
    const container = document.getElementById('projectList');
    if(list.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 mt-10">No projects yet.<br>Click + to create one.</div>`;
        return;
    }
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
    // Ensure AI view is closed by default
    if(isAIViewOpen) toggleAI(); 

    if (existingFiles) {
        files = existingFiles;
        document.getElementById('editor').value = files[activeTab];
    } else {
        files = { gs: '// Fetching latest code...', html: '<!-- Fetching latest code... -->' };
        document.getElementById('editor').value = files[activeTab];
        loading(true);
        try {
            const fetchedFiles = await api('GET_FILES', { scriptId: scriptId });
            files = fetchedFiles;
            document.getElementById('editor').value = files[activeTab];
        } catch(e) {
            document.getElementById('editor').value = "// Error fetching code.";
        } finally {
            loading(false);
        }
    }
}

async function deleteCurrentProject() {
    if(!currentProject) return;
    const confirmName = prompt(`Type "DELETE" to remove this project:`);
    if(confirmName !== "DELETE") return;
    
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
    const safeFiles = { gs: encode64(files.gs), html: encode64(files.html) };
    await api('SAVE_PROJECT', { id: currentProject.id, files: safeFiles });
    loading(false);
    // Visual feedback
    const btn = document.querySelector('button[onclick="save()"]');
    const orig = btn.innerText;
    btn.innerText = "Saved!";
    setTimeout(() => btn.innerText = orig, 1500);
}

async function deploy() {
    files[activeTab] = document.getElementById('editor').value;
    if(!confirm("Deploy to live web? (Takes ~30s)")) return;
    
    loading(true);
    const safeFiles = { gs: encode64(files.gs), html: encode64(files.html) };
    const res = await api('DEPLOY_PROJECT', { id: currentProject.id, files: safeFiles });
    loading(false);
    
    loadProjects(); // Refresh dashboard list
    
    const url = res.appUrl;
    const userClickedOk = prompt("Deployment Successful! \n\nCopy URL or click OK:", url);
    if (userClickedOk !== null) window.open(url, '_blank');
}

// --- UTILITIES ---
function encode64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) { return String.fromCharCode('0x' + p1); }));
}

function loading(show) { 
    document.getElementById('loader').classList.toggle('hidden', !show); 
}

async function pasteCode() { 
    try { 
        const t = await navigator.clipboard.readText(); 
        document.getElementById('editor').value = t; 
        files[activeTab] = t; 
    } catch(e) { 
        alert("Please manually paste (Long press > Paste)."); 
    } 
}

function copyCode() { 
    navigator.clipboard.writeText(document.getElementById('editor').value); 
    // Small toast notification logic could go here
}

async function forceUpdate() {
    if(!confirm("Force update App?")) return;
    loading(true);
    if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (let registration of registrations) await registration.unregister();
    }
    if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
    }
    window.location.reload(true);
}

const themeBtn = document.getElementById('themeBtn');
themeBtn.onclick = () => { 
    document.documentElement.classList.toggle('dark'); 
    localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light'); 
};
if (localStorage.theme === 'dark') document.documentElement.classList.add('dark');
