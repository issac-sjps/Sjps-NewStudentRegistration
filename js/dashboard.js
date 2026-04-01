import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let pieChart, barChart;

// --- 初始化與選單 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
        loadData();
    });
});

// --- 讀取雲端資料 ---
async function loadData() {
    const lamp = document.getElementById('connStatusLamp');
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = [];
        qs.forEach(d => allData.push(d.data()));
        
        // 排序：班級 -> 座號
        allData.sort((a, b) => {
            const cA = a["班級"] || "ZZZ";
            const cB = b["班級"] || "ZZZ";
            if (cA !== cB) return cA.localeCompare(cB, 'zh-TW');
            return (parseInt(a["座號"]) || 99) - (parseInt(b["座號"]) || 99);
        });

        lamp.className = "w-3 h-3 rounded-full lamp-green";
        renderUI();
    } catch (e) {
        lamp.className = "w-3 h-3 rounded-full lamp-red";
        console.error("連線錯誤", e);
    }
}

// --- 渲染畫面 ---
function renderUI() {
    let stats = { "線上報到": 0, "未報到": 0, "出國": 0, "私校": 0, "遷徙": 0 };
    let tableHtml = '';

    allData.forEach(s => {
        const status = s["報到狀態"] || "未報到";
        if (stats[status] !== undefined) stats[status]++; else stats["未報到"]++;
        
        const clsInfo = s["班級"] ? `${s["班級"]}-${s["座號"] || ''}` : '<span class="text-gray-300">未編班</span>';
        
        tableHtml += `
            <tr onclick="openEditModal('${s["身份證號"]}')" class="hover:bg-blue-50 transition">
                <td class="p-4"><span class="px-2 py-1 rounded text-xs ${status==='線上報到'?'bg-green-100 text-green-700':'bg-gray-100'}">${status}</span></td>
                <td class="p-4 font-bold">${clsInfo}</td>
                <td class="p-4 font-bold text-blue-700">${s["姓名"]}</td>
                <td class="p-4 text-gray-500">${s["聯絡電話"] || s["監護人手機"] || ''}</td>
                <td class="p-4 text-blue-500 underline text-xs">修改</td>
            </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = stats["線上報到"];
    document.getElementById('statPending').innerText = stats["未報到"];
    document.getElementById('statOther').innerText = stats["出國"] + stats["私校"];
    document.getElementById('studentTableBody').innerHTML = tableHtml;

    updateCharts(stats);
}

// --- 統計圖表 ---
function updateCharts(stats) {
    const pCtx = document.getElementById('anaPieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(stats),
            datasets: [{ data: Object.values(stats), backgroundColor: ['#22c55e','#ef4444','#f59e0b','#6366f1','#94a3b8'] }]
        },
        options: { maintainAspectRatio: false, plugins: { title: { display: true, text: '報到狀態分佈' } } }
    });
}

// --- 編輯 Modal 功能 ---
window.openEditModal = (id) => {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;
    document.getElementById('editId').value = s["身份證號"];
    document.getElementById('editName').value = s["姓名"];
    document.getElementById('editStatus').value = s["報到狀態"] || "未報到";
    document.getElementById('editClass').value = s["班級"] || "";
    document.getElementById('editSeat').value = s["座號"] || "";
    document.getElementById('editPhone').value = s["聯絡電話"] || "";
    document.getElementById('editModal').style.display = 'flex';
};

window.closeModal = () => { document.getElementById('editModal').style.display = 'none'; };

document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('editId').value;
    const updateData = {
        "姓名": document.getElementById('editName').value,
        "報到狀態": document.getElementById('editStatus').value,
        "班級": document.getElementById('editClass').value,
        "座號": document.getElementById('editSeat').value,
        "聯絡電話": document.getElementById('editPhone').value
    };
    await updateDoc(doc(db, "students", id), updateData);
    alert("修改成功");
    closeModal();
    loadData();
});

// --- 手動編班比對 ---
document.getElementById('matchNamesBtn').addEventListener('click', async () => {
    const cls = document.getElementById('inputClassName').value;
    const txt = document.getElementById('rawNameList').value;
    const log = document.getElementById('matchLog');
    if (!cls || !txt) return alert("資料不完整");

    const lines = txt.split('\n');
    for (let line of lines) {
        const match = line.match(/(\d+)\s+(.+)/);
        if (match) {
            const seat = match[1].trim();
            const name = match[2].trim();
            const student = allData.find(s => s["姓名"] === name);
            if (student) {
                await updateDoc(doc(db, "students", student["身份證號"]), { "班級": cls, "座號": seat });
                log.innerHTML += `<div class="text-green-600">✅ ${name} -> ${cls}-${seat}</div>`;
            } else {
                log.innerHTML += `<div class="text-red-500">❌ 找不到 ${name}</div>`;
            }
        }
    }
    loadData();
});

// --- (其餘匯入與重置邏輯同上) ---
document.getElementById('refreshDataBtn')?.addEventListener('click', loadData);
loadData();
