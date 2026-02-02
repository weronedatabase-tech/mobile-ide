// --- KILL SWITCH FOR STUCK SERVICE WORKERS ---
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
        for(let registration of registrations) {
            console.log('Unregistering SW:', registration);
            registration.unregister();
        }
    });
}

// --- CONFIGURATION ---
const API_URL = "https://script.google.com/macros/s/AKfycbxLAyqH_m33NSQi3TCzW0DR-gGQYWvXlGfngTnaVn_V5zYGUnpg17JzYxidgNc2v2TD/exec"; 

// --- STATE MANAGEMENT ---
let storedKey = localStorage.getItem('ide_key');
let currentProject = null;
let files = { gs: '', html: '' };
let activeTab = 'gs';

// --- INITIALIZATION ---
window.onload = () => {
    if (storedKey) {
        nav('dashboard');
        loadProjects();
    } else {
        nav('login');
    }
}

// --- AUTHENTICATION ---
function login() {
    const input = document.getElementById('accessKeyInput').value;
    if (!input) return alert("Enter password");
    storedKey = input;
    localStorage.setItem('ide_key', input);
    nav('dashboard');
    loadProjects();
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

function setTab(tab) {
    files[activeTab] = document.getElementById('editor').value;
    activeTab = tab;
    document.getElementById('editor').value = files[activeTab] || '';
    
    const tGs = document.getElementById('tab-gs');
    const tHtml = document.getElementById('tab-html');
    const activeClass = "border-blue-600 text-blue-600";
    const inactiveClass = "text-gray-500 border-transparent";
    
    if (tab === 'gs') {
        tGs.className = `flex-1 py-3 text-sm font-medium border-b-2 ${activeClass}`;
        tHtml.className = `flex-1 py-3 text-sm font-medium border-b-2 ${inactiveClass}`;
    } else {
        tHtml.className = `flex-1 py-3 text-sm font-medium border-b-2 ${activeClass}`;
        tGs.className = `flex-1 py-3 text-sm font-medium border-b-2 ${inactiveClass}`;
    }
}

// --- API CLIENT ---
async function api(action, payload = {}) {
    loading(true);
    try {
        // cache: "no-store" ensures we never use a stale cached response for API calls
        const res = await fetch(API_URL, {
            method: 'POST',
            cache: "no-store", 
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action: action, accessKey: storedKey, ...payload })
        });

        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } 
        catch (err) { 
            console.error("HTML Error:", text);
            throw new Error("Server returned HTML (Error) instead of JSON."); 
        }

        loading(false);
        if (!json.success) {
            if(json.error && json.error.includes("Wrong Password")) logout();
            throw new Error(json.error || "Unknown Error");
        }
        return json.data;
    } catch (e) {
        loading(false);
        // More descriptive error for debugging
        alert("Connection Error: " + e.message + "\n\nTry clearing browser cache.");
        throw e;
    }
}

// --- UTILITIES ---
function encode64(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) { return String.fromCharCode('0x' + p1); }));
}

function loading(show) { 
    document.getElementById('loader').classList.toggle('hidden', !show); 
}

// --- CORE LOGIC ---
async function loadProjects() {
    const list = await api('GET_PROJECTS');
    const container = document.getElementById('projectList');
    
    if(list.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 mt-10">No projects yet.<br>Click + to create one.</div>`;
        return;
    }
    
    container.innerHTML = list.map(p => `
        <div onclick="openProject('${p.id}', '${p.name}', '${p.scriptId}')" class="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border-l-4 border-l-blue-500 mb-4 active:scale-95 transition-transform">
            <h3 class="font-bold text-lg">${p.name}</h3>
            <p class="text-xs text-gray-500 mb-2">Updated: ${new Date(p.updated).toLocaleDateString()}</p>
            ${p.url ? `<a href="${p.url}" target="_blank" onclick="event.stopPropagation()" class="text-blue-500 text-sm font-bold flex items-center gap-1">🚀 Launch App</a>` : ''}
        </div>`).join('');
}

async function createProject() {
    const name = prompt("Project Name:");
    if (!name) return;
    const res = await api('CREATE_PROJECT', { name: name });
    openProject(res.id, res.name, res.scriptId, res.files);
}

async function openProject(id, name, scriptId, existingFiles = null) {
    currentProject = { id: id, name: name, scriptId: scriptId };
    nav('editor'); 

    if (existingFiles) {
        files = existingFiles;
        document.getElementById('editor').value = files[activeTab];
    } else {
        files = { gs: '// Fetching latest code...', html: '<!-- Fetching latest code... -->' };
        document.getElementById('editor').value = files[activeTab];
        try {
            const fetchedFiles = await api('GET_FILES', { scriptId: scriptId });
            files = fetchedFiles;
            document.getElementById('editor').value = files[activeTab];
        } catch(e) {
            document.getElementById('editor').value = "// Error fetching code.";
        }
    }
}

async function deleteCurrentProject() {
    if(!currentProject) return;
    const confirmName = prompt(`To delete "${currentProject.name}", type "DELETE":`);
    if(confirmName !== "DELETE") return;

    await api('DELETE_PROJECT', { id: currentProject.id });
    
    alert("Project Deleted");
    currentProject = null;
    nav('dashboard');
    loadProjects();
}

async function save() {
    files[activeTab] = document.getElementById('editor').value;
    const safeFiles = { gs: encode64(files.gs), html: encode64(files.html) };
    await api('SAVE_PROJECT', { id: currentProject.id, files: safeFiles });
    alert("Saved successfully!");
}

async function deploy() {
    files[activeTab] = document.getElementById('editor').value;
    if(!confirm("Deploy to live web? This takes about 30 seconds.")) return;
    
    const safeFiles = { gs: encode64(files.gs), html: encode64(files.html) };
    const res = await api('DEPLOY_PROJECT', { id: currentProject.id, files: safeFiles });
    
    loadProjects();
    
    const url = res.appUrl;
    const userClickedOk = prompt("Deployment Successful! \n\nCopy your App URL below or click OK to open:", url);
    if (userClickedOk !== null) window.open(url, '_blank');
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
    alert("Copied to clipboard"); 
}

// Force Update UI Button
async function forceUpdate() {
    if(!confirm("Force update App?")) return;
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
