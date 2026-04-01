import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let columns = [];
let hiddenCols = new Set();
let sortConfig = { key: '姓名', direction: 'asc' };

// 🔒 身分驗證
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "admin.html"; return; }
    const adminSnap = await getDoc(doc(db, "admins", user.email.toLowerCase()));
    if (!adminSnap.exists()) {
        alert("無授權權限！");
        await signOut(auth);
        window.location.href = "admin.html";
        return;
    }
    document.getElementById('authOverlay').style.display = 'none';
    loadData();
});

window.logout = async () => { if(confirm("登出？")) { await signOut(auth); window.location.href = "admin.html"; } };

// 📊 載入與標準化資料
async function loadData() {
    const qs = await getDocs(collection(db, "students"));
    allData = qs.docs.map(d => {
        const raw = d.data();
        // --- 強力容錯邏輯 ---
        raw.std_id = raw.身份證號 || raw.身分證號 || raw.身分證字號 || raw.身份證字號 || d.id;
        raw.std_name = raw.姓名 || "未命名";
        raw.std_class = raw.班級 || "";
        raw.std_no = raw.座號 || "";
        raw.std_status = raw.報到狀態 || "未報到";
        return raw;
    });

    if (allData.length > 0) {
        const keys = new Set();
        allData.forEach(s => Object.keys(s).forEach(k => {
            if(!['std_id','std_name','std_class','std_no','std_status'].includes(k)) keys.add(k);
        }));
        columns = ["std_status", "std_class", "std_no", "std_name", ...Array.from(keys)];
        renderToggles();
        renderAll();
    }
}

// 🛠️ 渲染名冊表格
function renderMainTable() {
    const head = document.getElementById('tHead');
    const body = document.getElementById('tBody');
    
    head.innerHTML = `<tr>${columns.map(c => `<th class="${hiddenCols.has(c)?'col-hidden':''}" onclick="doSort('${c}')">${c}</th>`).join('')}</tr>`;
    
    const sorted = [...allData].sort((a,b) => {
        let vA = a[sortConfig.key] || "";
        let vB = b[sortConfig.key] || "";
        return sortConfig.direction === 'asc' ? String(vA).localeCompare(vB,'zh') : String(vB).localeCompare(vA,'zh');
    });

    body.innerHTML = sorted.map(s => `
        <tr onclick="openModal('${s.std_id}')">
            ${columns.map(c => {
                let val = s[c] || "";
                if(c === 'std_status') val = `<span class="px-2 py-1 rounded text-xs font-bold ${val==='線上報到'?'bg-green-100 text-green-700':'bg-slate-100'}">${val}</span>`;
                return `<td class="${hiddenCols.has(c)?'col-hidden':''}">${val}</td>`;
            }).join('')}
        </tr>`).join('');
}

// 🔍 單一查詢邏輯
document.getElementById('qBtn').onclick = () => {
    const key = document.getElementById('qInput').value.trim();
    const s = allData.find(x => x.std_name === key || x.std_id === key);
    const res = document.getElementById('qResult');
    if(s) {
        res.classList.remove('hidden');
        res.innerHTML = `<h4 class="text-xl font-black">${s.std_name}</h4><p class="text-sm font-mono text-slate-400 mb-4">${s.std_id}</p>
            <div class="grid grid-cols-2 gap-2 text-sm">
                <p>班級：${s.std_class}</p><p>座號：${s.std_no}</p><p>狀態：${s.std_status}</p>
            </div>
            <button onclick="openModal('${s.std_id}')" class="w-full mt-4 bg-blue-600 text-white py-2 rounded-xl">完整編輯</button>`;
    } else { alert("查無此生"); }
};

// 📝 編輯彈窗
window.openModal = (id) => {
    const s = allData.find(x => x.std_id === id);
    if(!s) return;
    document.getElementById('displayId').innerText = id;
    document.getElementById('dynamicFields').innerHTML = Object.keys(s).map(k => `
        <div class="flex flex-col">
            <label class="text-[10px] font-bold text-slate-400 uppercase">${k}</label>
            <input type="text" class="edit-input border p-2 rounded-lg bg-slate-50" data-key="${k}" value="${s[k] || ''}">
        </div>`).join('');
    document.getElementById('editModal').style.display = 'flex';
};

document.getElementById('saveEditBtn').onclick = async () => {
    const id = document.getElementById('displayId').innerText;
    const newData = {};
    document.querySelectorAll('.edit-input').forEach(i => newData[i.dataset.key] = i.value);
    await updateDoc(doc(db, "students", id), newData);
    alert("儲存成功");
    location.reload();
};

function renderAll() { renderMainTable(); /* 其他統計邏輯 */ }
function renderToggles() { /* 欄位開關邏輯 */ }
