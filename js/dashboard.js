import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let pieChart, barChart; // 存放圖表實例

// --- 介面切換 ---
const menuBtns = document.querySelectorAll('.menu-btn');
const panels = document.querySelectorAll('.panel-section');

menuBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        menuBtns.forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        const targetId = btn.getAttribute('data-target');
        panels.forEach(p => p.id === targetId ? p.classList.remove('hidden') : p.classList.add('hidden'));
        if(targetId === 'dashboardPanel') loadDashboardData();
    });
});

// --- 初始化/更新圖表 ---
function updateCharts(done, pending, langStats) {
    // 1. 報到率圓餅圖
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    if (pieChart) pieChart.destroy();
    pieChart = new Chart(pieCtx, {
        type: 'doughnut',
        data: {
            labels: ['已報到', '未報到'],
            datasets: [{
                data: [done, pending],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderWidth: 0
            }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // 2. 本土語長條圖
    const barCtx = document.getElementById('barChart').getContext('2d');
    if (barChart) barChart.destroy();
    barChart = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: Object.keys(langStats),
            datasets: [{
                label: '選修人數',
                data: Object.values(langStats),
                backgroundColor: '#3b82f6'
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
        }
    });
}

// --- 載入資料並計算統計 ---
async function loadDashboardData() {
    const tbody = document.getElementById('studentTableBody');
    try {
        const querySnapshot = await getDocs(query(collection(db, "students"), orderBy("姓名", "asc")));
        let total = 0, done = 0, pending = 0;
        let langStats = { "閩南語": 0, "客家語": 0, "原住民族語": 0, "越南語": 0, "其他": 0 };
        let html = '';

        querySnapshot.forEach((doc) => {
            const d = doc.data();
            total++;
            if (d["報到狀態"] === '已報到') {
                done++;
                // 統計本土語
                const lang = d["本土語言名稱"] || "其他";
                if (lang.includes("閩南")) langStats["閩南語"]++;
                else if (lang.includes("客家")) langStats["客家語"]++;
                else if (lang.includes("原住")) langStats["原住民族語"]++;
                else if (lang.includes("越南")) langStats["越南語"]++;
                else langStats["其他"]++;
            } else {
                pending++;
            }
            
            const badge = d["報到狀態"] === '已報到' 
                ? '<span class="text-green-600 font-bold">● 已報到</span>' 
                : '<span class="text-red-500">○ 未報到</span>';

            html += `
                <tr class="hover:bg-gray-50">
                    <td class="p-3 border-b">${badge}</td>
                    <td class="p-3 border-b font-bold">${d["姓名"] || ''}</td>
                    <td class="p-3 border-b">${d["身份證號"] || ''}</td>
                    <td class="p-3 border-b text-gray-500">${d["學生編號"] || ''}</td>
                    <td class="p-3 border-b">${d["監護人姓名"] || ''}</td>
                    <td class="p-3 border-b text-xs">${d["本土語言名稱"] || '-'}</td>
                    <td class="p-3 border-b text-xs text-gray-400">${d["報到時間"] || '-'}</td>
                </tr>
            `;
        });

        document.getElementById('statTotal').innerText = total;
        document.getElementById('statDone').innerText = done;
        document.getElementById('statPending').innerText = pending;
        document.getElementById('updateTime').innerText = `最後更新：${new Date().toLocaleTimeString()}`;
        tbody.innerHTML = html || '<tr><td colspan="7" class="p-10 text-center">暫無資料</td></tr>';

        // 更新視覺化圖表
        updateCharts(done, pending, langStats);

    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="7" class="p-10 text-center text-red-500">讀取失敗</td></tr>';
    }
}

// 綁定按鈕與初始執行
document.getElementById('refreshTableBtn').addEventListener('click', loadDashboardData);
loadDashboardData();

// 其餘 Excel 匯入/匯出/重置功能請保留你之前的程式碼...
