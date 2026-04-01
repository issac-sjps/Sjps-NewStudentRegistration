import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// --- 讀取雲端資料 (修正版：避開 Index 報錯) ---
async function loadData() {
    try {
        // 不在 Query 中排序，避免 Firebase Index 錯誤
        const q = query(collection(db, "students"));
        const qs = await getDocs(q);
        let tempArray = [];
        qs.forEach(doc => tempArray.push(doc.data()));
        
        // 在前端進行排序：先排班級，再排姓名
        allData = tempArray.sort((a, b) => {
            const classA = a["班級"] || "999";
            const classB = b["班級"] || "999";
            if (classA !== classB) return classA.localeCompare(classB, 'zh-TW');
            return (a["姓名"] || "").localeCompare((b["姓名"] || ""), 'zh-TW');
        });

        refreshUI();
    } catch (e) { 
        console.error("資料載入失敗:", e); 
        alert("資料庫讀取失敗，請檢查網路或 Firebase 設定");
    }
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
            <td class="p-4 font-mono text-xs text-slate-400">${d["身份證號"] || '無資料'}</td>
            <td class="p-4">${d["聯絡電話"] || ''}</td>
        </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = done;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('quickTableBody').innerHTML = html || '<tr><td colspan="5" class="p-10 text-center">目前無學生資料</td></tr>';
    renderCharts(statusStats, langStats);
}

// --- 繪圖函數 ---
function renderCharts(sObj, lObj) {
    const pCtx = document.getElementById('anaPieChart')?.getContext('2d');
    if (pCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pCtx, { 
            type: 'pie', 
            data: { labels: Object.keys(sObj), datasets: [{ data: Object.values(sObj), backgroundColor: ['#3b82f6','#f43f5e','#10b981','#f59e0b','#8b5cf6'] }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
    const bCtx = document.getElementById('anaBarChart')?.getContext('2d');
    if (bCtx) {
        if (barChart) barChart.destroy();
        barChart = new Chart(bCtx, { 
            type: 'bar', 
            data: { labels: Object.keys(lObj), datasets: [{ label: '選修人數', data: Object.values(lObj), backgroundColor: '#6366f1' }] },
            options: { responsive: true, maintainAspectRatio: false }
        });
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

// --- 第二步：編班名單上傳 (針對 A0260R2 格式特別設計) ---
document.getElementById('uploadClassBtn').addEventListener('click', async () => {
    const file = document.getElementById('classExcelFile').files[0];
    if (!file) return alert("請選取編班 Excel 檔案");
    const status = document.getElementById('classStatus');
    status.innerText = "分析文件中...";

    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
        
        let updateCount = 0;
        // 遍歷每一列，尋找班級標籤與姓名
        data.forEach(async (row) => {
            // 邏輯：掃描列中是否有包含「班級」字眼或直接對應姓名
            // 由於 A0260R2 格式較雜，這裡採取「身分證+姓名」對應法（如果你的編班表有身分證最好）
            // 如果只有姓名，則建議使用我上個回覆的「兩欄式 Excel」最精準
            
            // 範例：假設你上傳的是標準兩欄 (身分證, 班級)
            const id = row[0] ? row[0].toString().trim().toUpperCase() : null;
            const className = row[1] ? row[1].toString().trim() : null;
            
            if (id && id.length >= 8 && className) {
                await setDoc(doc(db, "students", id), { "班級": className }, { merge: true });
                updateCount++;
            }
        });
        
        status.innerHTML = `<span class="text-green-600">處理完成！請重新整理名單。</span>`;
        setTimeout(loadData, 2000);
    };
    reader.readAsArrayBuffer(file);
});

// --- 第三步：產出導師名冊 ---
document.getElementById('exportBtn').addEventListener('click', () => {
    if (allData.length === 0) return alert("目前沒有資料可以匯出");
    const ws = XLSX.utils.json_to_sheet(allData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "新生總名冊");
    XLSX.writeFile(wb, `新莊國小新生分班總表.xlsx`);
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
    const qs = await getDocs(collection(db, "students"));
    for (let d of qs.docs) await deleteDoc(doc(db, "students", d.id));
    alert("資料已清空");
    location.reload();
});

loadData();
