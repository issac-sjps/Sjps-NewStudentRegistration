import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let columns = [];
let hiddenCols = new Set();
let sortConfig = { key: 'std_name', direction: 'asc' };

// --- 🔒 安全守衛：登入與權限檢查 ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('authOverlay');
    
    if (!user) {
        console.log("未登入，跳轉至 admin.html");
        window.location.href = "admin.html";
        return;
    }

    try {
        // 檢查白名單
        const adminEmail = user.email.toLowerCase();
        const adminSnap = await getDoc(doc(db, "admins", adminEmail));

        if (!adminSnap.exists()) {
            alert(`帳號 ${adminEmail} 不在白名單內！\n請先在 admin.html 加入此 Email。`);
            await signOut(auth);
            window.location.href = "admin.html";
            return;
        }

        console.log("驗證成功:", adminEmail);
        overlay.style.display = 'none'; // 隱藏鎖定畫面
        loadData(); // 開始載入學生資料

    } catch (error) {
        console.error("驗證過程發生錯誤:", error);
        alert("資料庫權限錯誤，請檢查 Firestore Rules 設定。");
    }
});

// --- 📥 載入與格式標準化 ---
async function loadData() {
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = qs.docs.map(d => {
            const raw = d.data();
            // 自動偵測 ID 欄位 (相容各種寫法)
            raw.std_id = raw.身份證號 || raw.身分證號 || raw.身分證字號 || raw.身份證字號 || d.id;
            raw.std_name = raw.姓名 || "未命名";
            raw.std_class = raw.班級 || "";
            raw.std_no = raw.座號 || "";
            raw.std_status = raw.報到狀態 || "未報到";
            return raw;
        });

        if (allData.length > 0) {
            // 抓取所有其他隱藏欄位
            const keys = new Set();
            allData.forEach(s => Object.keys(s).forEach(k => {
                if(!['std_id','std_name','std_class','std_no','std_status'].includes(k)) keys.add(k);
            }));
            
            // 欄位排序：狀態 > 班 > 座 > 姓 > 其他
            columns = ["std_status", "std_class", "std_no", "std_name", ...Array.from(keys)];
            
            renderToggles(); // 產生開關按鈕
            renderAll();     // 渲染表格與統計
        } else {
            document.getElementById('tBody').innerHTML = '<tr><td colspan="5" class="p-10 text-center">目前無學生資料，請執行匯入。</td></tr>';
        }
    } catch (e) {
        console.error("載入資料失敗:", e);
        if (e.message.includes("permission-denied")) {
            alert("Firestore 權限遭拒！請檢查 Rules 內的 isAdmin() 邏輯。");
        }
    }
}

// --- 🛠️ 介面渲染功能 ---
function renderMainTable() {
    const head = document.getElementById('tHead');
    const body = document.getElementById('tBody');
    if(!head || !body) return;

    // 表頭
    head.innerHTML = `<tr>${columns.map(c => `
        <th class="${hiddenCols.has(c)?'col-hidden':''}" onclick="doSort('${c}')">
            ${translateKey(c)} ${sortConfig.key === c ? (sortConfig.direction === 'asc' ? '↑':'↓') : ''}
        </th>`).join('')}</tr>`;
    
    // 排序
    const sorted = [...allData].sort((a,b) => {
        let vA = a[sortConfig.key] || "";
        let vB = b[sortConfig.key] || "";
        return sortConfig.direction === 'asc' ? String(vA).localeCompare(vB,'zh') : String(vB).localeCompare(vA,'zh');
    });

    // 內容
    body.innerHTML = sorted.map(s => `
        <tr class="hover:bg-blue-50" onclick="openModal('${s.std_id}')">
            ${columns.map(c => {
                let val = s[c] || "";
                if(c === 'std_status') {
                    const color = val === '線上報到' ? 'bg-green-100 text-green-700' : 'bg-slate-100';
                    val = `<span class="px-2 py-1 rounded text-xs font-bold ${color}">${val}</span>`;
                }
                return `<td class="${hiddenCols.has(c)?'col-hidden':''}">${val}</td>`;
            }).join('')}
        </tr>`).join('');
}

// 欄位名稱中文化映射
function translateKey(key) {
    const map = { std_status: '狀態', std_class: '班級', std_no: '座號', std_name: '姓名' };
    return map[key] || key;
}

// 欄位切換開關
function renderToggles() {
    const container = document.getElementById('colToggles');
    if(!container) return;
    container.innerHTML = columns.map(c => `
        <button onclick="toggleCol('${c}')" class="px-3 py-1 rounded-full text-xs border transition ${hiddenCols.has(c)?'bg-white text-slate-400':'bg-blue-100 text-blue-600 border-blue-200'}">
            ${translateKey(c)}
        </button>`).join('');
}

window.toggleCol = (c) => {
    hiddenCols.has(c) ? hiddenCols.delete(c) : hiddenCols.add(c);
    renderToggles();
    renderMainTable();
};

window.doSort = (c) => {
    sortConfig.direction = (sortConfig.key === c && sortConfig.direction === 'asc') ? 'desc' : 'asc';
    sortConfig.key = c;
    renderMainTable();
};

// 側邊欄切換
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    };
});

window.logout = async () => { if(confirm("確定登出管理系統？")) { await signOut(auth); window.location.href = "admin.html"; } };

function renderAll() { renderMainTable(); updateSummary(); }

// 統計卡片
function updateSummary() {
    let stats = { online: 0, total: allData.length };
    allData.forEach(s => { if(s.std_status === '線上報到') stats.online++; });
    const container = document.getElementById('statCards');
    if(!container) return;
    container.innerHTML = `
        <div class="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-blue-500 text-center"><p class="text-xs text-slate-400 font-bold">總學生數</p><p class="text-2xl font-black">${stats.total}</p></div>
        <div class="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-green-500 text-center"><p class="text-xs text-slate-400 font-bold">已報到</p><p class="text-2xl font-black text-green-600">${stats.online}</p></div>
        <div class="bg-white p-6 rounded-2xl shadow-sm border-b-4 border-red-500 text-center"><p class="text-xs text-slate-400 font-bold">待報到</p><p class="text-2xl font-black text-red-600">${stats.total - stats.online}</p></div>
    `;
}
