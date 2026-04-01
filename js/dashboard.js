import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let columns = []; // 動態儲存所有欄位名
let hiddenColumns = new Set(); // 儲存隱藏的欄位
let sortConfig = { key: '姓名', direction: 'asc' };
let charts = {};

// --- 1. 安全守衛：驗證白名單 ---
onAuthStateChanged(auth, async (user) => {
    const overlay = document.getElementById('authOverlay');
    if (!user) { window.location.href = "admin.html"; return; }
    try {
        const adminSnap = await getDoc(doc(db, "admins", user.email));
        if (!adminSnap.exists()) {
            alert("非授權管理員！");
            await signOut(auth);
            window.location.href = "admin.html";
            return;
        }
        overlay.style.display = 'none';
        loadData();
    } catch (e) { window.location.href = "admin.html"; }
});

window.logout = async () => { if(confirm("確定要登出嗎？")) { await signOut(auth); window.location.href = "admin.html"; } };

// --- 2. 資料載入與欄位解析 ---
async function loadData() {
    const qs = await getDocs(collection(db, "students"));
    allData = qs.docs.map(d => d.data());
    
    // 自動抓取所有不重複的欄位名
    const allKeys = new Set();
    allData.forEach(s => Object.keys(s).forEach(k => allKeys.add(k)));
    // 將「報到狀態、班級、座號、姓名、身分證」排在前面
    const priority = ["報到狀態", "班級", "座號", "姓名", "身份證號"];
    columns = priority.concat([...allKeys].filter(k => !priority.includes(k)));
    
    renderColumnToggles();
    renderAll();
}

// --- 3. 欄位顯示/隱藏控制 ---
function renderColumnToggles() {
    const area = document.getElementById('columnToggleArea');
    area.innerHTML = columns.map(col => `
        <button class="toggle-btn px-3 py-1 text-[11px] rounded-full border transition ${hiddenColumns.has(col) ? 'bg-white text-slate-400 border-slate-200' : 'bg-blue-100 text-blue-700 border-blue-200 font-bold'}" data-col="${col}">
            ${hiddenColumns.has(col) ? '👁️‍🗨️' : '✅'} ${col}
        </button>
    `).join('');

    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.onclick = () => {
            const col = btn.dataset.col;
            if (hiddenColumns.has(col)) hiddenColumns.delete(col);
            else hiddenColumns.add(col);
            renderColumnToggles();
            renderMainTable();
        };
    });
}

// --- 4. 名冊渲染 (支援動態欄位) ---
function renderMainTable() {
    const header = document.getElementById('mainTableHeader');
    const body = document.getElementById('mainTableBody');
    
    // 渲染表頭
    header.innerHTML = `<tr>${columns.map(col => `
        <th class="${hiddenColumns.has(col) ? 'column-hidden' : ''}" onclick="changeSort('${col}')">
            ${col} ${sortConfig.key === col ? (sortConfig.direction === 'asc' ? '↑' : '↓') : ''}
        </th>`).join('')}</tr>`;

    // 排序
    const sortedData = [...allData].sort((a, b) => {
        let vA = a[sortConfig.key] || "";
        let vB = b[sortConfig.key] || "";
        return sortConfig.direction === 'asc' ? (vA > vB ? 1 : -1) : (vA < vB ? 1 : -1);
    });

    // 渲染內容
    body.innerHTML = sortedData.map(s => `
        <tr class="hover:bg-blue-50 transition" onclick="openEditModal('${s.身份證號}')">
            ${columns.map(col => {
                let val = s[col] || "";
                let cellClass = hiddenColumns.has(col) ? 'column-hidden' : '';
                if(col === "報到狀態" && val === "線上報到") val = `<span class="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">已報到</span>`;
                return `<td class="${cellClass}">${val}</td>`;
            }).join('')}
        </tr>`).join('');
}

window.changeSort = (key) => {
    sortConfig.direction = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
    sortConfig.key = key;
    renderMainTable();
};

// --- 5. 學生專屬查詢邏輯 ---
document.getElementById('quickSearchBtn').onclick = () => {
    const keyword = document.getElementById('quickSearchInput').value.trim();
    if(!keyword) return;
    
    const result = allData.find(s => s.姓名 === keyword || s.身份證號 === keyword);
    const resultArea = document.getElementById('searchResultArea');
    
    if(result) {
        resultArea.classList.remove('hidden');
        resultArea.innerHTML = `
            <div class="bg-blue-50 p-6 rounded-3xl border-2 border-blue-200 text-left">
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h4 class="text-2xl font-black text-slate-800">${result.姓名}</h4>
                        <p class="text-sm text-slate-500 font-mono">${result.身份證號}</p>
                    </div>
                    <div class="text-right">
                        <span class="bg-blue-600 text-white px-4 py-1 rounded-full text-xs font-bold">${result.報到狀態 || '未報到'}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-4 text-xs">
                    <p><b>班級座號：</b>${result.班級 || '--'}-${result.座號 || '--'}</p>
                    <p><b>本土語言：</b>${result.本土語言名稱 || '--'}</p>
                    <p><b>聯絡電話：</b>${result.聯絡電話 || '--'}</p>
                    <p><b>就讀學校：</b>${result.就讀學校 || '--'}</p>
                </div>
                <div class="mt-6 flex space-x-2">
                    <button onclick="openEditModal('${result.身份證號}')" class="flex-1 bg-white border-2 border-blue-500 text-blue-600 py-3 rounded-xl font-bold">查看完整資料 / 修改</button>
                </div>
            </div>`;
    } else {
        alert("找不到該學生，請確認姓名或身分證是否正確。");
        resultArea.classList.add('hidden');
    }
};

// --- 6. 編輯與匯出單一學生 ---
async function openEditModal(id) {
    const s = allData.find(x => x.身份證號 === id);
    if (!s) return;
    document.getElementById('displayId').innerText = id;
    document.getElementById('dynamicFields').innerHTML = columns.map(key => `
        <div class="flex flex-col space-y-1">
            <label class="text-[10px] font-bold text-slate-400">${key}</label>
            <input type="text" class="dynamic-input border p-2 rounded-lg bg-slate-50" data-key="${key}" value="${s[key] || ''}">
        </div>`).join('');
    document.getElementById('editModal').style.display = 'flex';
    
    // 綁定單一生匯出
    document.getElementById('exportSingleBtn').onclick = () => exportToExcel([s], `學生資料_${s.姓名}`);
}

function exportToExcel(data, filename) {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, `${filename}.xlsx`);
}

document.getElementById('saveEditBtn').onclick = async () => {
    const id = document.getElementById('displayId').innerText;
    const data = {};
    document.querySelectorAll('.dynamic-input').forEach(i => data[i.dataset.key] = i.value);
    await updateDoc(doc(db, "students", id), data);
    alert("儲存成功！");
    document.getElementById('editModal').style.display = 'none';
    loadData();
};

document.getElementById('closeModalBtn').onclick = () => document.getElementById('editModal').style.display = 'none';

// --- 7. 其他基礎功能 (統計卡片、圖表、側邊欄、比對、匯入) ---
function renderAll() {
    renderMainTable();
    updateSummary();
    updateLangStats();
}

function updateSummary() {
    let stats = { online: 0, none: 0, other: 0 };
    let classDist = {};
    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        if (st === "線上報到") stats.online++;
        else if (st === "未報到") stats.none++;
        else stats.other++;
        const cls = s["班級"] || "未編班";
        classDist[cls] = (classDist[cls] || 0) + 1;
    });
    document.getElementById('statCards').innerHTML = `
        <div class="bg-white p-6 rounded-2xl border-b-4 border-blue-500 shadow-sm text-center"><p class="text-xs text-slate-400 font-bold">總人數</p><p class="text-3xl font-black">${allData.length}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-green-500 shadow-sm text-center"><p class="text-xs text-slate-400 font-bold">已報到</p><p class="text-3xl font-black text-green-600">${stats.online}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-red-500 shadow-sm text-center"><p class="text-xs text-slate-400 font-bold">未報到</p><p class="text-3xl font-black text-red-600">${stats.none}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-yellow-500 shadow-sm text-center"><p class="text-xs text-slate-400 font-bold">其他去向</p><p class="text-3xl font-black text-yellow-600">${stats.other}</p></div>`;
}

// (語言統計、編班、匯入邏輯與前版一致，請完整保留)
// ... [省略重複的 Chart 與 匯入比對邏輯] ...

// 側邊欄切換
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    };
});
