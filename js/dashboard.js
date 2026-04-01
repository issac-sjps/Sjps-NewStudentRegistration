import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let pieChart, barChart;

// --- 選單切換 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
        loadData();
    });
});

// --- 讀取資料 ---
async function loadData() {
    const lamp = document.getElementById('connStatusLamp');
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = [];
        qs.forEach(d => allData.push(d.data()));
        
        // 前端排序
        allData.sort((a, b) => {
            const cA = a["班級"] || "ZZZ";
            const cB = b["班級"] || "ZZZ";
            if (cA !== cB) return cA.localeCompare(cB, 'zh-TW');
            return (parseInt(a["座號"]) || 99) - (parseInt(b["座號"]) || 99);
        });

        if (lamp) lamp.className = "w-3 h-3 rounded-full lamp-green";
        renderUI();
    } catch (e) {
        if (lamp) lamp.className = "w-3 h-3 rounded-full lamp-red";
        console.error("載入失敗:", e);
    }
}

// --- 渲染 UI (修正 InnerHTML Null 錯誤) ---
function renderUI() {
    const tableBody = document.getElementById('studentTableBody');
    if (!tableBody) return; 

    let stats = { "線上報到": 0, "未報到": 0, "出國": 0, "私校": 0, "遷徙": 0 };
    let tableHtml = '';

    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        if (stats[st] !== undefined) stats[st]++; else stats["未報到"]++;
        
        const cls = s["班級"] ? `${s["班級"]}-${s["座號"] || ''}` : '<span class="text-gray-300 italic">未編班</span>';
        
        tableHtml += `
            <tr class="student-row hover:bg-blue-50 transition border-b" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded text-[10px] ${st==='線上報到'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500'}">${st}</span></td>
                <td class="p-4 font-bold text-blue-600">${cls}</td>
                <td class="p-4 font-bold text-slate-700">${s["姓名"]}</td>
                <td class="p-4 text-gray-400 text-xs">${s["聯絡電話"] || s["監護人手機"] || ''}</td>
                <td class="p-4 text-blue-500 underline text-[10px]">修改</td>
            </tr>`;
    });

    // 更新統計數字
    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = stats["線上報到"];
    document.getElementById('statPending').innerText = stats["未報到"];
    document.getElementById('statOther').innerText = (stats["出國"] || 0) + (stats["私校"] || 0);
    
    tableBody.innerHTML = tableHtml || '<tr><td colspan="5" class="p-10 text-center text-gray-400">目前雲端無資料</td></tr>';

    // 重新綁定事件
    document.querySelectorAll('.student-row').forEach(row => {
        row.addEventListener('click', () => openEditModal(row.dataset.id));
    });

    updateCharts(stats);
}

// --- 圖表 ---
function updateCharts(stats) {
    const pCanvas = document.getElementById('anaPieChart');
    if (!pCanvas) return;
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pCanvas.getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#22c55e','#ef4444','#f59e0b','#6366f1','#94a3b8'] }] },
        options: { maintainAspectRatio: false }
    });
}

// --- 編輯 Modal ---
function openEditModal(id) {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;
    document.getElementById('editId').value = s["身份證號"];
    document.getElementById('editName').value = s["姓名"];
    document.getElementById('editStatus').value = s["報到狀態"] || "未報到";
    document.getElementById('editClass').value = s["班級"] || "";
    document.getElementById('editSeat').value = s["座號"] || "";
    document.getElementById('editPhone').value = s["聯絡電話"] || "";
    document.getElementById('editModal').style.display = 'flex';
}

document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
});

document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const data = {
        "姓名": document.getElementById('editName').value,
        "報到狀態": document.getElementById('editStatus').value,
        "班級": document.getElementById('editClass').value,
        "座號": document.getElementById('editSeat').value,
        "聯絡電話": document.getElementById('editPhone').value
    };
    await updateDoc(doc(db, "students", id), data);
    document.getElementById('editModal').style.display = 'none';
    loadData();
});

// --- 建立測試學生 (身分證: T123456789) ---
document.getElementById('createTestStudentBtn').addEventListener('click', async () => {
    const testID = "T123456789";
    await setDoc(doc(db, "students", testID), {
        "姓名": "測試員(模擬重複報到)",
        "身份證號": testID,
        "出生年月日": "2017-01-01",
        "報到狀態": "未報到",
        "班級": "",
        "座號": ""
    });
    alert("測試生已建立！\n請使用 T123456789 / 2017-01-01 進行首頁報到測試。");
    loadData();
});

// --- 編班比對 ---
document.getElementById('matchNamesBtn').addEventListener('click', async () => {
    const cls = document.getElementById('inputClassName').value;
    const txt = document.getElementById('rawNameList').value;
    const log = document.getElementById('matchLog');
    if (!cls || !txt) return alert("請填寫班級並貼上名單");
    log.innerHTML = "處理中...";
    for (let line of txt.split('\n')) {
        const m = line.match(/(\d+)\s+(.+)/);
        if (m) {
            const seat = m[1].trim(), name = m[2].trim();
            const s = allData.find(x => x["姓名"] === name);
            if (s) {
                await updateDoc(doc(db, "students", s["身份證號"]), { "班級": cls, "座號": seat });
                log.innerHTML += `<div class="text-green-600">✅ ${name} (${seat}號)</div>`;
            } else log.innerHTML += `<div class="text-red-500">❌ 找不到 ${name}</div>`;
        }
    }
    loadData();
});

// --- 匯出 Excel ---
document.getElementById('exportBtn').addEventListener('click', () => {
    const exportData = allData.filter(s => s["班級"]).map(s => ({
        "班級": s["班級"], "座號": s["座號"], "姓名": s["姓名"], "電話": s["聯絡電話"] || ""
    }));
    if (exportData.length === 0) return alert("尚無編班資料可供匯出");
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "編班名冊");
    XLSX.writeFile(wb, "新莊國小分班名冊.xlsx");
});

// --- 匯入/重置 ---
document.getElementById('importBtn').addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選取 Excel 檔案");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": "未報到" }, { merge: true });
        }
        alert("資料庫同步完成！");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

document.getElementById('resetInput').addEventListener('input', e => {
    const b = document.getElementById('resetBtn');
    b.disabled = e.target.value !== '確認清空';
    b.className = b.disabled ? "w-full bg-red-600 text-white py-3 rounded-xl font-bold opacity-20 cursor-not-allowed" : "w-full bg-red-600 text-white py-3 rounded-xl font-bold opacity-100";
});

document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm("確定刪除所有雲端學生資料？")) return;
    const qs = await getDocs(collection(db, "students"));
    for (let d of qs.docs) await deleteDoc(doc(db, "students", d.id));
    location.reload();
});

document.getElementById('refreshDataBtn').addEventListener('click', loadData);
loadData();
