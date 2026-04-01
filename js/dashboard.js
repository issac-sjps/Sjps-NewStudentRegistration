import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let pieChart, barChart;
let allData = [];

// --- 選單切換邏輯 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.panel-section').forEach(p => p.id === target ? p.classList.remove('hidden') : p.classList.add('hidden'));
        loadData();
    });
});

// --- 從雲端載入並手動排序 (解決 Index 報錯問題) ---
async function loadData() {
    try {
        const qs = await getDocs(query(collection(db, "students")));
        let rawData = [];
        qs.forEach(doc => rawData.push(doc.data()));

        // 在前端進行排序，避免 Firebase Index 限制
        allData = rawData.sort((a, b) => {
            const classA = a["班級"] || "ZZZ";
            const classB = b["班級"] || "ZZZ";
            if (classA !== classB) return classA.localeCompare(classB, 'zh-TW');
            const seatA = parseInt(a["座號"]) || 99;
            const seatB = parseInt(b["座號"]) || 99;
            return seatA - seatB;
        });

        updateUI();
    } catch (e) {
        console.error("載入失敗:", e);
    }
}

// --- 更新畫面與統計 ---
function updateUI() {
    let done = 0, pending = 0, html = '';
    let statusStats = {}, langStats = { "閩南語": 0, "客家語": 0, "原住民語": 0, "其他": 0 };

    allData.forEach(d => {
        const status = d["報到狀態"] || "未報到";
        const cls = d["班級"] ? `${d["班級"]}-${d["座號"] || ''}` : '<span class="text-red-400 font-normal italic">未編班</span>';
        
        if (status === '線上報到') {
            done++;
            const l = d["本土語言名稱"] || "";
            if (l.includes("閩南")) langStats["閩南語"]++;
            else if (l.includes("客家")) langStats["客家語"]++;
            else if (l.includes("原住")) langStats["原住民語"]++;
            else langStats["其他"]++;
        } else { pending++; }

        statusStats[status] = (statusStats[status] || 0) + 1;
        html += `<tr class="hover:bg-slate-50 transition">
            <td class="p-4">${status === '線上報到' ? '✅' : '❌'}</td>
            <td class="p-4 font-bold text-blue-600">${cls}</td>
            <td class="p-4 font-bold">${d["姓名"]}</td>
            <td class="p-4 font-mono text-xs text-slate-400">${d["身份證號"]}</td>
            <td class="p-4">${d["聯絡電話"] || d["監護人手機"] || ''}</td>
            <td class="p-4 text-xs">${d["本土語言名稱"] || '-'}</td>
        </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = done;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('quickTableBody').innerHTML = html || '<tr><td colspan="6" class="p-10 text-center">雲端無資料，請先匯入。</td></tr>';
    drawCharts(statusStats, langStats);
}

// --- 繪製統計圖 ---
function drawCharts(sObj, lObj) {
    const pCtx = document.getElementById('anaPieChart')?.getContext('2d');
    if (pCtx) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pCtx, { type: 'pie', data: { labels: Object.keys(sObj), datasets: [{ data: Object.values(sObj), backgroundColor: ['#3b82f6','#f43f5e','#10b981','#f59e0b'] }] }, options: { maintainAspectRatio: false } });
    }
    const bCtx = document.getElementById('anaBarChart')?.getContext('2d');
    if (bCtx) {
        if (barChart) barChart.destroy();
        barChart = new Chart(bCtx, { type: 'bar', data: { labels: Object.keys(lObj), datasets: [{ label: '人數', data: Object.values(lObj), backgroundColor: '#6366f1' }] }, options: { maintainAspectRatio: false } });
    }
}

// --- 功能：姓名比對編班 (手動貼上文字版) ---
document.getElementById('matchNamesBtn').addEventListener('click', async () => {
    const className = document.getElementById('inputClassName').value;
    const rawText = document.getElementById('rawNameList').value;
    const logDiv = document.getElementById('matchLog');
    
    if (!className || !rawText) return alert("請輸入班級並貼上名單");
    
    const lines = rawText.split('\n');
    logDiv.innerHTML = `<div class="text-blue-500 font-bold">開始處理 ${className} 班級對應...</div>`;
    
    let success = 0, fail = 0;
    for (let line of lines) {
        if (!line.trim()) continue;
        // 正規表達式拆分：抓數字(座號) 跟 姓名
        const match = line.match(/(\d+)\s+(.+)/);
        if (match) {
            const seat = match[1].trim();
            const name = match[2].trim();
            // 在雲端資料中找姓名
            const student = allData.find(s => s["姓名"] === name);
            if (student) {
                await setDoc(doc(db, "students", student["身份證號"]), { "班級": className, "座號": seat }, { merge: true });
                logDiv.innerHTML += `<div class="text-green-600">✅ ${name} (對應成功：${seat}號)</div>`;
                success++;
            } else {
                logDiv.innerHTML += `<div class="text-red-500">❌ ${name} (找不到人)</div>`;
                fail++;
            }
        }
    }
    alert(`處理完畢！成功：${success} / 失敗：${fail}`);
    loadData();
});

// --- 功能：匯入基礎名冊 ---
document.getElementById('importBtn').addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選取名冊");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": "未報到", "班級": "" }, { merge: true });
        }
        alert("匯入雲端完成！");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

// --- 功能：匯出名冊 (依勾選欄位) ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const selectedCols = ['班級', '座號', '姓名'];
    document.querySelectorAll('.col-check:checked').forEach(cb => selectedCols.push(cb.value));

    const exportData = allData
        .filter(s => s["班級"] && s["班級"] !== "")
        .map(s => {
            let row = {};
            selectedCols.forEach(c => row[c] = s[c] || "");
            return row;
        });

    if (exportData.length === 0) return alert("尚無任何已編班的資料");
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "分班名冊");
    XLSX.writeFile(wb, `新莊國小_編班產出表.xlsx`);
});

// --- 功能：重置資料 ---
document.getElementById('resetInput').addEventListener('input', (e) => {
    const b = document.getElementById('resetBtn');
    b.disabled = e.target.value !== '確認清空';
    b.style.opacity = e.target.value === '確認清空' ? '1' : '0.2';
});
document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm("確定刪除？")) return;
    const qs = await getDocs(collection(db, "students"));
    for (let d of qs.docs) await deleteDoc(doc(db, "students", d.id));
    location.reload();
});

document.getElementById('refreshDataBtn').addEventListener('click', loadData);
loadData();
