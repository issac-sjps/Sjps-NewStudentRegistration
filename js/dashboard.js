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
        allData.sort((a, b) => (a["班級"] || "ZZZ").localeCompare(b["班級"] || "ZZZ", 'zh-TW') || (parseInt(a["座號"]) || 99) - (parseInt(b["座號"]) || 99));
        lamp.className = "w-3 h-3 rounded-full lamp-green";
        renderUI();
    } catch (e) {
        lamp.className = "w-3 h-3 rounded-full lamp-red";
        console.error(e);
    }
}

// --- 渲染 UI ---
function renderUI() {
    let stats = { "線上報到": 0, "未報到": 0, "出國": 0, "私校": 0, "遷徙": 0 };
    let tableHtml = '';

    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        if (stats[st] !== undefined) stats[st]++; else stats["未報到"]++;
        const cls = s["班級"] ? `${s["班級"]}-${s["座號"] || ''}` : '<span class="text-gray-300">未編班</span>';
        
        // 注意這裡：不再使用 onclick，改用 data-id
        tableHtml += `
            <tr class="student-row hover:bg-blue-50 transition" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded text-xs ${st==='線上報到'?'bg-green-100 text-green-700':'bg-gray-100'}">${st}</span></td>
                <td class="p-4 font-bold">${cls}</td>
                <td class="p-4 font-bold text-blue-700">${s["姓名"]}</td>
                <td class="p-4 text-gray-500">${s["聯絡電話"] || ''}</td>
                <td class="p-4 text-blue-500 underline text-xs">修改</td>
            </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = stats["線上報到"];
    document.getElementById('statPending').innerText = stats["未報到"];
    document.getElementById('statOther').innerText = stats["出國"] + stats["私校"];
    document.getElementById('studentTableBody').innerHTML = tableHtml;

    // 重新綁定每一列的點擊事件
    document.querySelectorAll('.student-row').forEach(row => {
        row.addEventListener('click', () => openEditModal(row.dataset.id));
    });

    updateCharts(stats);
}

// --- 圖表 ---
function updateCharts(stats) {
    const pCtx = document.getElementById('anaPieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pCtx, {
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

function closeModal() { document.getElementById('editModal').style.display = 'none'; }

// 綁定按鈕事件
document.getElementById('closeModalBtn').addEventListener('click', closeModal);
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
    closeModal();
    loadData();
});

// --- 編班比對 ---
document.getElementById('matchNamesBtn').addEventListener('click', async () => {
    const cls = document.getElementById('inputClassName').value;
    const txt = document.getElementById('rawNameList').value;
    const log = document.getElementById('matchLog');
    if (!cls || !txt) return alert("請輸入資料");
    log.innerHTML = "處理中...";
    for (let line of txt.split('\n')) {
        const m = line.match(/(\d+)\s+(.+)/);
        if (m) {
            const seat = m[1].trim(), name = m[2].trim();
            const s = allData.find(x => x["姓名"] === name);
            if (s) {
                await updateDoc(doc(db, "students", s["身份證號"]), { "班級": cls, "座號": seat });
                log.innerHTML += `<div class="text-green-600">✅ ${name} OK</div>`;
            } else log.innerHTML += `<div class="text-red-500">❌ 找不到 ${name}</div>`;
        }
    }
    loadData();
});

// --- 匯入功能 ---
document.getElementById('importBtn').addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選擇檔案");
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": row["報到狀態"] || "未報到" }, { merge: true });
        }
        alert("匯入完成");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

// --- 重置與刷新 ---
document.getElementById('resetInput').addEventListener('input', e => {
    const b = document.getElementById('resetBtn');
    b.disabled = e.target.value !== '確認清空';
    b.style.opacity = b.disabled ? '0.2' : '1';
});
document.getElementById('resetBtn').addEventListener('click', async () => {
    if (!confirm("確定刪除所有學生？")) return;
    const qs = await getDocs(collection(db, "students"));
    for (let d of qs.docs) await deleteDoc(doc(db, "students", d.id));
    location.reload();
});
document.getElementById('refreshDataBtn').addEventListener('click', loadData);

// 初次啟動
loadData();
