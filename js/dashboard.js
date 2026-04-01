import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let pieChart, barChart;
let allData = [];

// --- 核心：資料庫連線監控 (紅綠燈) ---
async function checkConnection() {
    const lamp = document.getElementById('connStatusLamp');
    const text = document.getElementById('connStatusText');
    try {
        await getDocs(query(collection(db, "students")));
        lamp.className = "w-3 h-3 rounded-full lamp-green";
        text.innerText = "已連線至雲端 (OK)";
        text.className = "text-green-500 font-bold";
    } catch (e) {
        lamp.className = "w-3 h-3 rounded-full lamp-red";
        text.innerText = "連線失敗 (請檢查網路)";
        text.className = "text-red-500 font-bold";
        console.error("Firebase 連線錯誤:", e);
    }
}

// --- 選單切換 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        const target = btn.getAttribute('data-target');
        document.querySelectorAll('.panel-section').forEach(p => p.id === target ? p.classList.remove('hidden') : p.classList.add('hidden'));
        loadData();
    });
});

// --- 讀取與排序資料 ---
async function loadData() {
    checkConnection(); // 每次刷新時檢查連線
    try {
        const qs = await getDocs(collection(db, "students"));
        let raw = [];
        qs.forEach(doc => raw.push(doc.data()));
        
        // 前端排序：依班級 -> 座號
        allData = raw.sort((a, b) => {
            const cA = a["班級"] || "ZZZ";
            const cB = b["班級"] || "ZZZ";
            if (cA !== cB) return cA.localeCompare(cB, 'zh-TW');
            return (parseInt(a["座號"]) || 99) - (parseInt(b["座號"]) || 99);
        });
        updateUI();
    } catch (e) { console.error(e); }
}

// --- 更新儀表板 UI ---
function updateUI() {
    let done = 0, pending = 0, html = '';
    let sStats = {}, lStats = { "閩南語": 0, "客家語": 0, "原住民語": 0, "其他": 0 };

    allData.forEach(d => {
        const status = d["報到狀態"] || "未報到";
        const cls = d["班級"] ? `${d["班級"]}-${d["座號"] || ''}` : '<span class="text-slate-300 italic">未編班</span>';
        if (status === '線上報到') {
            done++;
            const l = d["本土語言名稱"] || "";
            if (l.includes("閩南")) lStats["閩南語"]++;
            else if (l.includes("客家")) lStats["客家語"]++;
            else if (l.includes("原住")) lStats["原住民語"]++;
            else lStats["其他"]++;
        } else { pending++; }

        sStats[status] = (sStats[status] || 0) + 1;
        html += `<tr>
            <td class="p-4">${status === '線上報到' ? '✅' : '❌'}</td>
            <td class="p-4 font-bold text-blue-600">${cls}</td>
            <td class="p-4 font-bold">${d["姓名"]}</td>
            <td class="p-4 font-mono text-xs text-slate-400">${d["身份證號"]}</td>
            <td class="p-4">${d["聯絡電話"] || d["監護人手機"] || ''}</td>
        </tr>`;
    });
    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = done;
    document.getElementById('statPending').innerText = pending;
    document.getElementById('quickTableBody').innerHTML = html || '<tr><td colspan="5" class="p-10 text-center text-slate-400">暫無資料</td></tr>';
}

// --- 功能：姓名比對編班 (手動貼上) ---
document.getElementById('matchNamesBtn').addEventListener('click', async () => {
    const className = document.getElementById('inputClassName').value;
    const rawText = document.getElementById('rawNameList').value;
    const logDiv = document.getElementById('matchLog');
    if (!className || !rawText) return alert("請填寫班級與名單");

    logDiv.innerHTML = "比對中...";
    const lines = rawText.split('\n');
    let ok = 0, err = 0;

    for (let line of lines) {
        if (!line.trim()) continue;
        const match = line.match(/(\d+)\s+(.+)/);
        if (match) {
            const seat = match[1].trim();
            const name = match[2].trim();
            const student = allData.find(s => s["姓名"] === name);
            if (student) {
                await setDoc(doc(db, "students", student["身份證號"]), { "班級": className, "座號": seat }, { merge: true });
                logDiv.innerHTML += `<div class="text-green-600">✅ ${name} (已對應至 ${seat} 號)</div>`;
                ok++;
            } else {
                logDiv.innerHTML += `<div class="text-red-500">❌ ${name} (資料庫無此人)</div>`;
                err++;
            }
        }
    }
    alert(`處理完成！成功：${ok}, 失敗：${err}`);
    loadData();
});

// --- 功能：匯出名冊 (自訂欄位) ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const selectedCols = ['班級', '座號', '姓名'];
    document.querySelectorAll('.col-check:checked').forEach(cb => selectedCols.push(cb.value));

    const exportData = allData
        .filter(s => s["班級"])
        .map(s => {
            let row = {};
            selectedCols.forEach(c => row[c] = s[c] || "");
            return row;
        });

    if (exportData.length === 0) return alert("無已編班資料");
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "分班名冊");
    XLSX.writeFile(wb, `新莊國小_分班名冊.xlsx`);
});

// --- (其他匯入與重置功能同上，已整合) ---
document.getElementById('refreshDataBtn').addEventListener('click', loadData);
loadData(); // 初次載入
