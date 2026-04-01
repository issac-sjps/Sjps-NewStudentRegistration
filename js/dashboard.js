import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let sortConfig = { key: '姓名', direction: 'asc' };
let charts = {};

async function loadData() {
    const qs = await getDocs(collection(db, "students"));
    allData = qs.docs.map(d => d.data());
    renderAll();
}

function renderAll() {
    applySortAndRender();
    updateSummary();
    updateLangStats(); // 更新語言統計功能
}

// --- 語言統計核心功能 ---
function updateLangStats() {
    const langCounts = {};
    const langGroups = {};

    allData.forEach(s => {
        const lang = s["本土語言名稱"] || s["本土語"] || "未填寫";
        langCounts[lang] = (langCounts[lang] || 0) + 1;
        
        if (!langGroups[lang]) langGroups[lang] = [];
        langGroups[lang].push(s);
    });

    // 1. 更新統計卡片
    const container = document.getElementById('langListContainer');
    if(container) {
        container.innerHTML = Object.entries(langCounts).map(([name, count]) => `
            <div class="bg-white p-6 rounded-2xl border-l-4 border-purple-500 shadow-sm">
                <p class="text-xs text-slate-400 font-bold">語言類別</p>
                <div class="flex justify-between items-end mt-1">
                    <p class="text-xl font-black text-slate-700">${name}</p>
                    <p class="text-2xl font-black text-purple-600">${count} <span class="text-xs text-slate-400">人</span></p>
                </div>
            </div>
        `).join('');
    }

    // 2. 繪製語言比例圖
    renderLangChart(langCounts);

    // 3. 生成分組名冊表格
    const tableArea = document.getElementById('langGroupingTable');
    if(tableArea) {
        tableArea.innerHTML = Object.entries(langGroups).map(([lang, students]) => `
            <div>
                <h5 class="bg-slate-100 p-2 px-4 rounded-lg font-bold text-slate-600 mb-2 inline-block">${lang} (${students.length}人)</h5>
                <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                    ${students.map(st => `
                        <div class="text-xs p-2 bg-white border rounded shadow-sm flex justify-between">
                            <span class="font-bold">${st.姓名}</span>
                            <span class="text-slate-400">${st.班級 || ''}${st.座號 || ''}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }
}

function renderLangChart(counts) {
    const ctx = document.getElementById('langPieChart')?.getContext('2d');
    if (!ctx) return;
    if (charts.lang) charts.lang.destroy();
    charts.lang = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#64748b']
            }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
    });
}

// --- 以下為原有功能 (表格渲染、排序、統計卡片) ---

function applySortAndRender() {
    allData.sort((a, b) => {
        let vA = a[sortConfig.key] || "";
        let vB = b[sortConfig.key] || "";
        if (vA < vB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (vA > vB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    const tbody = document.getElementById('studentTableBody');
    if(!tbody) return;
    tbody.innerHTML = allData.map(s => `
        <tr class="student-row hover:bg-blue-50 border-b" data-id="${s.身份證號}">
            <td class="p-4"><span class="badge ${s.報到狀態==='線上報到'?'bg-online':'bg-pending'}">${s.報到狀態 || '未報到'}</span></td>
            <td class="p-4 font-bold text-blue-600">${s.班級 || '--'}-${s.座號 || '--'}</td>
            <td class="p-4 font-black">${s.姓名}</td>
            <td class="p-4"><span class="${(s.本土語言名稱||'').includes('國小')?'text-school':''}">${s.本土語言名稱 || '--'}</span></td>
            <td class="p-4 font-mono text-xs text-slate-400">${s.身份證號}</td>
            <td class="p-4 text-xs">${s.聯絡電話 || ''}</td>
        </tr>
    `).join('');
    // 綁定編輯事件
    document.querySelectorAll('.student-row').forEach(r => r.onclick = () => openEditModal(r.dataset.id));
}

// 統計卡片更新
function updateSummary() {
    const stats = { total: allData.length, done: 0, pending: 0, other: 0 };
    const classDist = {};
    allData.forEach(s => {
        if(s.報到狀態 === '線上報到') stats.done++;
        else if(s.報到狀態 === '未報到' || !s.報到狀態) stats.pending++;
        else stats.other++;
        classDist[s.班級] = (classDist[s.班級] || 0) + 1;
    });
    document.getElementById('statCards').innerHTML = `
        <div class="bg-white p-6 rounded-2xl border-b-4 border-blue-500 shadow-sm"><p class="text-xs text-slate-400">總人數</p><p class="text-3xl font-black">${stats.total}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-green-500 shadow-sm"><p class="text-xs text-slate-400">已報到</p><p class="text-3xl font-black text-green-600">${stats.done}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-red-500 shadow-sm"><p class="text-xs text-slate-400">未報到</p><p class="text-3xl font-black text-red-600">${stats.pending}</p></div>
        <div class="bg-white p-6 rounded-2xl border-b-4 border-purple-500 shadow-sm"><p class="text-xs text-slate-400">本土語類別</p><p class="text-3xl font-black text-purple-600">${Object.keys(allData.reduce((acc,s)=>{acc[s.本土語言名稱]=1; return acc},{})).length}</p></div>
    `;
    // 原有 Chart 繪製邏輯... (略)
}

// 側邊欄切換
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    };
});

// 初始化
loadData();
