// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, setDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- 選單切換 ---
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

// --- 載入資料 (顯示所有欄位) ---
async function loadDashboardData() {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center text-gray-500">正在同步雲端資料庫...</td></tr>';
    
    try {
        const q = query(collection(db, "students"), orderBy("學生編號", "asc"));
        const querySnapshot = await getDocs(q);
        let total = 0, done = 0, pending = 0, html = '';

        querySnapshot.forEach((doc) => {
            const d = doc.data();
            total++;
            d["報到狀態"] === '已報到' ? done++ : pending++;
            
            const badge = d["報到狀態"] === '已報到' 
                ? '<span class="bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">已報到</span>' 
                : '<span class="bg-red-100 text-red-700 px-3 py-1 rounded-full font-bold text-xs">未報到</span>';

            html += `
                <tr class="hover:bg-slate-50 transition border-b border-gray-50">
                    <td class="p-4">${badge}</td>
                    <td class="p-4 font-mono text-gray-500">${d["學生編號"] || ''}</td>
                    <td class="p-4 font-mono">${d["身份證號"] || ''}</td>
                    <td class="p-4 font-bold text-slate-800">${d["姓名"] || ''}</td>
                    <td class="p-4">${d["出生日期"] || ''}</td>
                    <td class="p-4 max-w-xs truncate text-gray-500">${d["聯絡地址"] || ''}</td>
                    <td class="p-4">${d["聯絡電話"] || ''}</td>
                    <td class="p-4">${d["監護人姓名"] || ''}</td>
                    <td class="p-4">${d["監護人電話"] || ''}</td>
                    <td class="p-4">${d["父親手機號碼"] || ''}</td>
                    <td class="p-4">${d["母親手機號碼"] || ''}</td>
                    <td class="p-4 text-center">${d["選修本土語"] || ''}</td>
                    <td class="p-4">${d["本土語言名稱"] || ''}</td>
                    <td class="p-4 text-xs text-slate-400">${d["報到時間"] || '-'}</td>
                </tr>
            `;
        });

        document.getElementById('statTotal').innerText = total;
        document.getElementById('statDone').innerText = done;
        document.getElementById('statPending').innerText = pending;
        tbody.innerHTML = html || '<tr><td colspan="14" class="p-10 text-center">目前沒有學生資料，請先匯入名冊。</td></tr>';
    } catch (e) { 
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="14" class="p-10 text-center text-red-500 font-bold">❌ 無法讀取資料，請確認 Firebase Rules 是否已開啟！</td></tr>';
    }
}
document.getElementById('refreshTableBtn').addEventListener('click', loadDashboardData);
loadDashboardData();

// --- Excel 匯入 (自動欄位對應) ---
const excelFile = document.getElementById('excelFile');
excelFile.addEventListener('change', (e) => document.getElementById('fileNameDisplay').innerText = e.target.files[0]?.name || "");

document.getElementById('importBtn').addEventListener('click', () => {
    const file = excelFile.files[0];
    if (!file) return alert("請先選取 Excel 檔案！");
    
    const btn = document.getElementById('importBtn');
    const status = document.getElementById('importStatus');
    btn.disabled = true; btn.innerText = "資料寫入中，請勿關閉視窗...";

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

            let count = 0;
            for (let row of jsonData) {
                // 強制確保關鍵欄位對應正確
                const rocId = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
                if (!rocId || !row['姓名']) continue;

                row['身份證號'] = rocId;
                if (!row['報到狀態']) row['報到狀態'] = '未報到';

                await setDoc(doc(db, "students", rocId), row, { merge: true });
                count++;
            }
            status.innerHTML = `<span class="text-green-600 font-bold">✅ 匯入成功！共處理 ${count} 筆學生資料。</span>`;
        } catch (err) { 
            status.innerHTML = `<span class="text-red-600 font-bold">❌ 匯入失敗：${err.message}</span>`;
        } finally { 
            btn.disabled = false; btn.innerText = "開始執行雲端匯入";
        }
    };
    reader.readAsArrayBuffer(file);
});

// --- 導師分班產出 (匯出完整 28 欄位) ---
document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    btn.disabled = true; btn.innerText = "正在向雲端提取資料...";
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        const dataArr = [];
        querySnapshot.forEach(doc => dataArr.push(doc.data()));
        
        const worksheet = XLSX.utils.json_to_sheet(dataArr);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "新生總名冊");
        XLSX.writeFile(workbook, `高雄市新莊國小新生報到名冊_${new Date().toLocaleDateString()}.xlsx`);
    } catch (e) { alert("匯出失敗！"); }
    finally { btn.disabled = false; btn.innerText = "點擊下載完整 .XLSX 檔案"; }
});

// --- 重置 ---
const resetInput = document.getElementById('resetInput');
const resetBtn = document.getElementById('resetBtn');
resetInput.addEventListener('input', (e) => {
    resetBtn.disabled = e.target.value !== '確認清空';
    resetBtn.style.opacity = e.target.value === '確認清空' ? '1' : '0.3';
    resetBtn.style.cursor = e.target.value === '確認清空' ? 'pointer' : 'not-allowed';
});

resetBtn.addEventListener('click', async () => {
    if (confirm("極度危險！所有學生資料（包含已報到內容）將永久消失，確定？")) {
        resetBtn.innerText = "刪除中...";
        const qs = await getDocs(collection(db, "students"));
        const batch = [];
        qs.forEach(d => batch.push(deleteDoc(doc(db, "students", d.id))));
        await Promise.all(batch);
        alert("資料庫已完全清空。");
        location.reload();
    }
});
