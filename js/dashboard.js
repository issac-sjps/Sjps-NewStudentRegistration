import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let sortConfig = { key: '姓名', direction: 'asc' };
let charts = { pie: null, bar: null };

// --- 重要：修正 Uncaught ReferenceError ---
// 將排序函數掛載到全域 window 物件，HTML onclick 才能抓到
window.toggleSort = (key) => {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }
    applySortAndRender();
};

async function loadData() {
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = qs.docs.map(d => d.data());
        applySortAndRender();
        updateSummary(); // 更新統計數據與圖表
    } catch (e) {
        console.error("載入失敗:", e);
    }
}

function applySortAndRender() {
    allData.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        
        if (['班級', '座號'].includes(sortConfig.key)) {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    renderTable();
}

function renderTable() {
    const tbody = document.getElementById('studentTableBody');
    if(!tbody) return;
    
    tbody.innerHTML = allData.map(s => {
        const st = s["報到狀態"] || "未報到";
        const statusClass = st === "線上報到" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400";
        return `
            <tr class="student-row hover:bg-blue-50 border-b" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded text-[10px] font-bold ${statusClass}">${st}</span></td>
                <td class="p-4 font-bold text-blue-600">${s["班級"] || '--'}</td>
                <td class="p-4 font-bold text-blue-600">${s["座號"] || '--'}</td>
                <td class="p-4 font-bold">${s["姓名"]}</td>
                <td class="p-4 font-mono text-slate-400">${s["身份證號"]}</td>
                <td class="p-4 text-xs">${s["出生年月日"] || ''}</td>
                <td class="p-4 text-xs">${s["本土語言名稱"] || ''}</td>
                <td class="p-4 text-xs">${s["聯絡電話"] || s["監護人手機"] || ''}</td>
                <td class="p-4 text-[10px] text-slate-400 truncate max-w-[150px]">${s["通訊地址"] || ''}</td>
                <td class="p-4 text-[10px] text-slate-400 truncate max-w-[150px]">${s["戶籍地址"] || ''}</td>
            </tr>`;
    }).join('');

    document.querySelectorAll('.student-row').forEach(r => {
        r.addEventListener('click', () => openEditModal(r.dataset.id));
    });
}

// --- 修正：數據統計功能 ---
function updateSummary() {
    let stats = { "線上報到": 0, "未報到": 0, "其它": 0 };
    let classDist = {}; // 各班人數

    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        if (st === "線上報到") stats["線上報到"]++;
        else if (st === "未報到") stats["未報到"]++;
        else stats["其它"]++;

        const cls = s["班級"] || "未編班";
        classDist[cls] = (classDist[cls] || 0) + 1;
    });

    // 更新卡片數字
    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = stats["線上報到"];
    document.getElementById('statPending').innerText = stats["未報到"];
    document.getElementById('statOther').innerText = stats["其它"];

    // 更新圖表
    renderCharts(stats, classDist);
}

function renderCharts(stats, classDist) {
    const pieCtx = document.getElementById('anaPieChart')?.getContext('2d');
    const barCtx = document.getElementById('anaBarChart')?.getContext('2d');

    if (charts.pie) charts.pie.destroy();
    if (charts.bar) charts.bar.destroy();

    if (pieCtx) {
        charts.pie = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(stats),
                datasets: [{ data: Object.values(stats), backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'] }]
            },
            options: { maintainAspectRatio: false }
        });
    }

    if (barCtx) {
        charts.bar = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(classDist),
                datasets: [{ label: '人數', data: Object.values(classDist), backgroundColor: '#3b82f6' }]
            },
            options: { maintainAspectRatio: false }
        });
    }
}

// --- 彈窗編輯 ---
function openEditModal(id) {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;
    document.getElementById('displayId').innerText = id;
    const container = document.getElementById('dynamicFields');
    container.innerHTML = Object.keys(s).sort().map(key => `
        <div class="flex flex-col space-y-1">
            <label class="text-[10px] font-bold text-slate-400 uppercase">${key}</label>
            ${key === "報到狀態" ? `
                <select class="dynamic-input border p-2 rounded-lg" data-key="${key}">
                    <option value="未報到" ${s[key]==='未報到'?'selected':''}>未報到</option>
                    <option value="線上報到" ${s[key]==='線上報到'?'selected':''}>線上報到</option>
                    <option value="出國" ${s[key]==='出國'?'selected':''}>出國</option>
                    <option value="私校" ${s[key]==='私校'?'selected':''}>就讀私校</option>
                </select>
            ` : `<input type="text" class="dynamic-input border p-2 rounded-lg" data-key="${key}" value="${s[key] || ''}">`}
        </div>
    `).join('');
    document.getElementById('editModal').style.display = 'flex';
}

// 事件綁定
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('displayId').innerText;
    const data = {};
    document.querySelectorAll('.dynamic-input').forEach(i => data[i.dataset.key] = i.value);
    await updateDoc(doc(db, "students", id), data);
    document.getElementById('editModal').style.display = 'none';
    loadData();
});

document.getElementById('closeModalBtn').onclick = () => document.getElementById('editModal').style.display = 'none';

document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// 匯入與測試功能
document.getElementById('createTestStudentBtn')?.addEventListener('click', async () => {
    const tid = "T123456789";
    await setDoc(doc(db, "students", tid), { "姓名": "測試生", "身份證號": tid, "出生年月日": "2017-01-01", "報到狀態": "未報到" });
    alert("測試生建立成功");
    loadData();
});

document.getElementById('importBtn')?.addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選擇檔案");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": "未報到" }, { merge: true });
        }
        alert("匯入完成");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

// 初始化
loadData();
