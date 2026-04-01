import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let pieChart;

// --- 切換分頁 ---
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
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = [];
        qs.forEach(d => allData.push(d.data()));
        renderUI();
    } catch (e) { console.error(e); }
}

// --- 渲染 UI ---
function renderUI() {
    const tableBody = document.getElementById('studentTableBody');
    let stats = { "線上報到": 0, "未報到": 0, "出國": 0, "私校": 0, "遷徙": 0 };
    let tableHtml = '';

    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        if (stats[st] !== undefined) stats[st]++; else stats["未報到"]++;
        const cls = s["班級"] ? `${s["班級"]}-${s["座號"] || ''}` : '<span class="text-gray-300">未編班</span>';
        
        tableHtml += `
            <tr class="student-row hover:bg-blue-50 border-b" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded text-xs ${st==='線上報到'?'bg-green-100 text-green-700':'bg-gray-100'}">${st}</span></td>
                <td class="p-4 font-bold text-blue-600">${cls}</td>
                <td class="p-4 font-bold">${s["姓名"]}</td>
                <td class="p-4 text-gray-400 text-xs">${s["聯絡電話"] || ''}</td>
            </tr>`;
    });

    document.getElementById('statTotal').innerText = allData.length;
    document.getElementById('statDone').innerText = stats["線上報到"];
    document.getElementById('statPending').innerText = stats["未報到"];
    document.getElementById('statOther').innerText = (stats["出國"] || 0) + (stats["私校"] || 0);
    tableBody.innerHTML = tableHtml;

    document.querySelectorAll('.student-row').forEach(row => {
        row.addEventListener('click', () => openEditModal(row.dataset.id));
    });
    updateCharts(stats);
}

// --- 統計圖表 ---
function updateCharts(stats) {
    const ctx = document.getElementById('anaPieChart')?.getContext('2d');
    if (!ctx) return;
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: Object.keys(stats), datasets: [{ data: Object.values(stats), backgroundColor: ['#22c55e','#ef4444','#f59e0b','#6366f1','#94a3b8'] }] },
        options: { maintainAspectRatio: false }
    });
}

// --- 彈窗控制 (修正顯示問題) ---
function openEditModal(id) {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;
    document.getElementById('editId').value = s["身份證號"];
    document.getElementById('editName').value = s["姓名"];
    document.getElementById('editStatus').value = s["報到狀態"] || "未報到";
    document.getElementById('editClass').value = s["班級"] || "";
    document.getElementById('editSeat').value = s["座號"] || "";
    document.getElementById('editPhone').value = s["聯絡電話"] || "";
    
    // 強制設定為 flex 並顯示
    const modal = document.getElementById('editModal');
    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

document.getElementById('closeModalBtn').addEventListener('click', closeModal);
document.getElementById('editModal').addEventListener('click', closeModal);

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

// --- 功能性按鈕 ---
document.getElementById('createTestStudentBtn').addEventListener('click', async () => {
    const testID = "T123456789";
    await setDoc(doc(db, "students", testID), {
        "姓名": "測試員", "身份證號": testID, "出生年月日": "2017-01-01", "報到狀態": "未報到"
    });
    alert("測試生建立成功");
    loadData();
});

document.getElementById('resetInput').addEventListener('input', e => {
    const b = document.getElementById('resetBtn');
    b.disabled = e.target.value !== '確認清空';
    b.style.opacity = b.disabled ? '0.2' : '1';
});

document.getElementById('refreshDataBtn').addEventListener('click', loadData);
loadData();
