import { db, auth } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let columns = [];
let hiddenCols = new Set();
let sortConfig = { key: 'std_name', direction: 'asc' };
let charts = {};

// --- 1. 安全驗證 ---
onAuthStateChanged(auth, async (user) => {
    if (!user) { window.location.href = "admin.html"; return; }
    const adminSnap = await getDoc(doc(db, "admins", user.email.toLowerCase()));
    if (!adminSnap.exists()) {
        alert("無管理權限！");
        await signOut(auth);
        window.location.href = "admin.html";
        return;
    }
    document.getElementById('authOverlay').style.display = 'none';
    loadData();
});

// --- 2. 資料載入與分發 ---
async function loadData() {
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = qs.docs.map(d => {
            const raw = d.data();
            raw.std_id = raw.身份證號 || raw.身分證號 || raw.身分證字號 || raw.身份證字號 || d.id;
            raw.std_name = raw.姓名 || "未命名";
            raw.std_class = raw.班級 || "";
            raw.std_no = raw.座號 || "";
            raw.std_status = raw.報到狀態 || "未報到";
            raw.std_lang = raw.本土語言名稱 || raw.本土語 || "未填";
            return raw;
        });

        // 欄位處理
        const keys = new Set();
        allData.forEach(s => Object.keys(s).forEach(k => {
            if(!['std_id','std_name','std_class','std_no','std_status','std_lang'].includes(k)) keys.add(k);
        }));
        columns = ["std_status", "std_class", "std_no", "std_name", "std_lang", ...Array.from(keys)];

        renderAll(); 
    } catch (e) { console.error(e); }
}

function renderAll() {
    renderMainTable();
    updateSummary();
    renderCharts();
    renderLangStats();
}

// --- 3. 統計圖表 (補回) ---
function renderCharts() {
    // 報到比例圓餅圖
    const statusCount = { '線上報到': 0, '未報到': 0, '其他': 0 };
    allData.forEach(s => {
        if (s.std_status === '線上報到') statusCount['線上報到']++;
        else if (s.std_status === '未報到') statusCount['未報到']++;
        else statusCount['其他']++;
    });

    const ctxPie = document.getElementById('anaPieChart').getContext('2d');
    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCount),
            datasets: [{ data: Object.values(statusCount), backgroundColor: ['#22c55e', '#ef4444', '#f59e0b'] }]
        },
        options: { maintainAspectRatio: false }
    });

    // 班級人數長條圖
    const classCount = {};
    allData.forEach(s => {
        const c = s.std_class || "未編班";
        classCount[c] = (classCount[c] || 0) + 1;
    });

    const ctxBar = document.getElementById('anaBarChart').getContext('2d');
    if (charts.bar) charts.bar.destroy();
    charts.bar = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: Object.keys(classCount),
            datasets: [{ label: '人數', data: Object.values(classCount), backgroundColor: '#3b82f6' }]
        },
        options: { maintainAspectRatio: false }
    });
}

// --- 4. 本土語統計 (補回) ---
function renderLangStats() {
    const langStats = {};
    allData.forEach(s => {
        const l = s.std_lang;
        if(!langStats[l]) langStats[l] = [];
        langStats[l].push(s.std_name);
    });

    // 顯示卡片
    document.getElementById('langList').innerHTML = Object.entries(langStats).map(([name, list]) => `
        <div class="bg-white p-6 rounded-2xl border shadow-sm">
            <p class="text-sm text-slate-400 font-bold">${name}</p>
            <p class="text-3xl font-black text-blue-600">${list.length} <span class="text-sm text-slate-400">人</span></p>
        </div>
    `).join('');

    // 顯示彙整清單
    document.getElementById('langGroupContent').innerHTML = Object.entries(langStats).map(([name, list]) => `
        <div class="mb-4">
            <h5 class="font-bold text-slate-600 mb-1">【${name}】</h5>
            <p class="text-sm text-slate-500">${list.join('、')}</p>
        </div>
    `).join('');
}

// --- 5. 編班比對 (補回) ---
document.getElementById('runMatchBtn').onclick = async () => {
    const className = document.getElementById('targetClass').value.trim();
    const rawText = document.getElementById('rawList').value.trim();
    const log = document.getElementById('matchLog');
    if(!className || !rawText) return alert("請輸入班級與名單");

    log.innerHTML = `🚀 開始處理 ${className} 班...<br>`;
    const rows = rawText.split('\n');
    const batch = writeBatch(db);
    let count = 0;

    for(let row of rows) {
        const parts = row.trim().split(/\s+/);
        if(parts.length < 2) continue;
        const no = parts[0];
        const name = parts[1];

        const student = allData.find(s => s.std_name === name);
        if(student) {
            const ref = doc(db, "students", student.std_id);
            batch.update(ref, { "班級": className, "座號": no });
            log.innerHTML += `<span class="text-green-400">✅ 匹配成功：${no} ${name}</span><br>`;
            count++;
        } else {
            log.innerHTML += `<span class="text-red-400">❌ 找不到學生：${name}</span><br>`;
        }
    }
    await batch.commit();
    log.innerHTML += `---<br>🎉 處理完畢，共更新 ${count} 筆資料。`;
    loadData();
};

// --- 其他名冊、統計、登出邏輯保持上一版即可 ---
// ... (renderMainTable, updateSummary, toggleCol, doSort 都在這裡) ...
