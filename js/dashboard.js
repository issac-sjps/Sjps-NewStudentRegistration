import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let pieChart, barChart;

// --- 安全的元素選取函數，避免報錯 ---
const safeAddListener = (id, event, callback) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, callback);
};

// --- 選單切換 ---
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        const targetId = btn.getAttribute('data-target');
        document.querySelectorAll('.panel-section').forEach(p => p.id === targetId ? p.classList.remove('hidden') : p.classList.add('hidden'));
        if(targetId === 'dashboardPanel') loadDashboardData();
    });
});

// --- 統計圖表更新 ---
function renderCharts(done, pending, langStats) {
    const pieCanvas = document.getElementById('pieChart');
    if (pieCanvas) {
        if (pieChart) pieChart.destroy();
        pieChart = new Chart(pieCanvas, {
            type: 'doughnut',
            data: { labels: ['已報到', '未報到'], datasets: [{ data: [done, pending], backgroundColor: ['#22c55e', '#f43f5e'] }] },
            options: { plugins: { legend: { display: false } }, responsive: true }
        });
    }

    const barCanvas = document.getElementById('barChart');
    if (barCanvas) {
        if (barChart) barChart.destroy();
        barChart = new Chart(barCanvas, {
            type: 'bar',
            data: { labels: Object.keys(langStats), datasets: [{ label: '選修人數', data: Object.values(langStats), backgroundColor: '#3b82f6' }] },
            options: { responsive: true, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } }
        });
    }
}

// --- 載入資料 ---
async function loadDashboardData() {
    const tbody = document.getElementById('studentTableBody');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "students"), orderBy("姓名", "asc"));
        const qs = await getDocs(q);
        let total = 0, done = 0, pending = 0;
        let langStats = { "閩南語": 0, "客家語": 0, "原住民語": 0, "其他": 0 };
        let html = '';

        qs.forEach(doc => {
            const d = doc.data();
            total++;
            if (d["報到狀態"] === '已報到') {
                done++;
                const lang = d["本土語言名稱"] || "";
                if(lang.includes("閩南")) langStats["閩南語"]++;
                else if(lang.includes("客家")) langStats["客家語"]++;
                else if(lang.includes("原住")) langStats["原住民語"]++;
                else langStats["其他"]++;
            } else { pending++; }

            html += `<tr>
                <td class="p-3">${d["報到狀態"] === '已報到' ? '✅' : '❌'}</td>
                <td class="p-3 font-bold">${d["姓名"] || ''}</td>
                <td class="p-3 font-mono text-xs">${d["身份證號"] || ''}</td>
                <td class="p-3">${d["學生編號"] || ''}</td>
                <td class="p-3 text-xs">${d["本土語言名稱"] || ''}</td>
                <td class="p-3">${d["監護人姓名"] || ''}</td>
                <td class="p-3">${d["監護人電話"] || ''}</td>
                <td class="p-3">${d["出生日期"] || ''}</td>
                <td class="p-3 max-w-xs truncate">${d["聯絡地址"] || ''}</td>
                <td class="p-3 text-gray-400 text-xs">${d["報到時間"] || '-'}</td>
            </tr>`;
        });

        document.getElementById('statTotal').innerText = total;
        document.getElementById('statDone').innerText = done;
        document.getElementById('statPending').innerText = pending;
        document.getElementById('updateTime').innerText = `最後更新: ${new Date().toLocaleTimeString()}`;
        tbody.innerHTML = html || '<tr><td colspan="10" class="p-10 text-center">目前無資料</td></tr>';
        renderCharts(done, pending, langStats);
    } catch (e) { console.error(e); }
}

// --- 綁定事件 (安全方式) ---
safeAddListener('refreshTableBtn', 'click', loadDashboardData);

safeAddListener('importBtn', 'click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return alert("請選取 Excel");
    const status = document.getElementById('importStatus');
    status.innerText = "寫入中...";
    
    const reader = new FileReader();
    reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": row['報到狀態'] || "未報到" }, { merge: true });
        }
        status.innerText = "✅ 匯入成功";
        loadDashboardData();
    };
    reader.readAsArrayBuffer(file);
});

safeAddListener('exportBtn', 'click', async () => {
    const qs = await getDocs(collection(db, "students"));
    const data = [];
    qs.forEach(d => data.push(d.data()));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "新生名單");
    XLSX.writeFile(wb, "新生報到總表.xlsx");
});

safeAddListener('resetInput', 'input', (e) => {
    const btn = document.getElementById('resetBtn');
    btn.disabled = e.target.value !== "確認清空";
    btn.style.opacity = e.target.value === "確認清空" ? "1" : "0.3";
});

safeAddListener('resetBtn', 'click', async () => {
    if(!confirm("確定要清空資料庫嗎？")) return;
    const qs = await getDocs(collection(db, "students"));
    const delPromises = [];
    qs.forEach(d => delPromises.push(deleteDoc(doc(db, "students", d.id))));
    await Promise.all(delPromises);
    alert("已清空");
    location.reload();
});

// 初始載入
loadDashboardData();
