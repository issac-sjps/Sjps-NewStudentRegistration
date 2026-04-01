import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let pieChart, barChart;
let allData = [];

// --- 選單控制 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.panel-section').forEach(p => p.id === target ? p.classList.remove('hidden') : p.classList.add('hidden'));
        loadData();
    });
});

// --- 讀取雲端資料 ---
async function loadData() {
    const q = query(collection(db, "students"), orderBy("班級", "asc"), orderBy("姓名", "asc"));
    const qs = await getDocs(q);
    allData = [];
    qs.forEach(doc => allData.push(doc.data()));
    refreshUI();
}

// --- 更新介面與圖表 ---
function refreshUI() {
    let done = 0, pending = 0, html = '';
    let statusStats = {}, langStats = { "閩南語": 0, "客家語": 0, "原住民語": 0, "其他": 0 };

    allData.forEach(d => {
        const status = d["報到狀態"] || "未報到";
        const cls = d["班級"] || '<span class="text-red-400">未編班</span>';
        if (status === '線上報到') {
            done++;
            const lang = d["本土語言名稱"] || "";
            if (lang.includes("閩南")) langStats["閩南語"]++;
            else if (lang.includes("客家")) langStats["客家語"]++;
            else if (lang.includes("原住")) langStats["原住民語"]++;
            else langStats["其他"]++;
        } else { pending++; }

        statusStats[status] = (statusStats[status] || 0) + 1;
        html += `<tr>
            <td class="p-4">${status === '線上報到' ? '✅' : '❌'}</td>
            <td class="p-4 font-bold">${cls}</td>
            <td class="p-4">${d["姓名"]}</td>
            <td class="p-4 font-mono text-xs text-slate-400">${d["身份證號"]}</td>
            <td class="p-4">${d["聯絡電話"] || ''}</td>
        </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = done;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('quickTableBody').innerHTML = html;
    renderCharts(statusStats, langStats);
}

// --- 繪圖函數 ---
function renderCharts(sObj, lObj) {
    const pCtx = document.getElementById('anaPieChart')?.getContext('2d');
    if (pCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pCtx, { type: 'pie', data: { labels: Object.keys(sObj), datasets: [{ data: Object.values(sObj), backgroundColor: ['#3b82f6','#f43f5e','#10b981','#f59e0b'] }] } });
    }
    const bCtx = document.getElementById('anaBarChart')?.getContext('2d');
    if (bCtx) {
        if (barChart) barChart.destroy();
        barChart = new Chart(bCtx, { type: 'bar', data: { labels: Object.keys(lObj), datasets: [{ label: '選修人數', data: Object.values(lObj), backgroundColor: '#6366f1' }] } });
    }
}

// --- 第一步：匯入基礎名冊 ---
document.getElementById('importBtn').addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選取名冊檔案");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": "未報到", "班級": "" }, { merge: true });
        }
        alert("基礎名冊匯入完成！");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

// --- 第二步：批次編班上傳 (核心新功能) ---
document.getElementById('uploadClassBtn').addEventListener('click', async () => {
    const file = document.getElementById('classExcelFile').files[0];
    if (!file) return alert("請選取編班 Excel 檔案");
    const status = document.getElementById('classStatus');
    status.innerText = "正在同步班級資料...";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        let count = 0;
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            const cls = row['班級'] || "";
            if (id && cls) {
                await setDoc(doc(db, "students", id), { "班級": cls }, { merge: true });
                count++;
            }
        }
        status.innerHTML = `<span class="text-green-600">成功更新 ${count} 位學生的班級資訊！</span>`;
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

// --- 第三步：產出導師名冊 ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "新生總名冊");
    XLSX.writeFile(wb, `新莊國小新生分班名冊_${new Date().toLocaleDateString()}.xlsx`);
});

// --- 重置與刷新 ---
document.getElementById('refreshDataBtn').addEventListener('click', loadData);
document.getElementById('resetInput').addEventListener('input', (e) => {
    const btn = document.getElementById('resetBtn');
    btn.disabled = e.target.value !== '確認清空';
    btn.style.opacity = e.target.value === '確認清空' ? '1' : '0.2';
});
document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm("確定要刪除所有學生資料？")) return;
    for (let d of allData) await deleteDoc(doc(db, "students", d["身份證號"]));
    location.reload();
});

loadData();
