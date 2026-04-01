// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === 1. 選單切換邏輯 ===
const menuBtns = document.querySelectorAll('.menu-btn');
const panels = document.querySelectorAll('.panel-section');

menuBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // 重置按鈕樣式
        menuBtns.forEach(b => { b.classList.remove('bg-blue-600', 'font-bold'); b.classList.add('hover:bg-slate-700'); });
        btn.classList.add('bg-blue-600', 'font-bold');
        btn.classList.remove('hover:bg-slate-700');
        
        // 切換面板
        const targetId = btn.getAttribute('data-target');
        panels.forEach(panel => {
            if (panel.id === targetId) {
                panel.classList.remove('hidden');
                panel.classList.add('block');
                if(targetId === 'dashboardPanel') loadDashboardData(); // 切換到儀表板時自動重整
            } else {
                panel.classList.remove('block');
                panel.classList.add('hidden');
            }
        });
    });
});

// === 2. 儀表板資料載入 ===
async function loadDashboardData() {
    const tbody = document.getElementById('studentTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-gray-500">資料載入中...</td></tr>';
    
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        let total = 0; let done = 0; let pending = 0;
        let html = '';

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            total++;
            if (data["報到狀態"] === '已報到') done++; else pending++;
            
            const statusBadge = data["報到狀態"] === '已報到' 
                ? '<span class="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-bold">已報到</span>' 
                : '<span class="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-bold">未報到</span>';

            html += `
                <tr class="border-b hover:bg-gray-50">
                    <td class="p-3">${data["姓名"] || ''}</td>
                    <td class="p-3">${data["身份證號"] || ''}</td>
                    <td class="p-3">${statusBadge}</td>
                    <td class="p-3 text-gray-500">${data["報到時間"] || '-'}</td>
                </tr>
            `;
        });

        document.getElementById('statTotal').innerText = total;
        document.getElementById('statDone').innerText = done;
        document.getElementById('statPending').innerText = pending;
        tbody.innerHTML = html || '<tr><td colspan="4" class="p-4 text-center text-gray-500">目前尚無資料</td></tr>';

    } catch (error) {
        console.error("載入儀表板失敗:", error);
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-red-500">資料載入失敗，請檢查權限</td></tr>';
    }
}
document.getElementById('refreshTableBtn').addEventListener('click', loadDashboardData);
// 初始載入
loadDashboardData();

// === 3. Excel 匯入功能 ===
const excelFile = document.getElementById('excelFile');
const importBtn = document.getElementById('importBtn');
const importStatus = document.getElementById('importStatus');

importBtn.addEventListener('click', () => {
    const file = excelFile.files[0];
    if (!file) return alert("請先選擇 Excel 檔案！");

    importBtn.innerText = "處理中..."; importBtn.disabled = true;
    importStatus.innerText = "解析中..."; importStatus.className = "mt-4 text-blue-600";

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });

            let successCount = 0;
            for (let row of jsonData) {
                // 自動相容欄位名稱
                const rocId = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
                row['身份證號'] = rocId; // 統一寫入正確的 key
                if (!row['報到狀態']) row['報到狀態'] = '未報到';

                if (!rocId || !row['姓名']) continue; 

                await setDoc(doc(db, "students", rocId), row, { merge: true });
                successCount++;
                if (successCount % 10 === 0) importStatus.innerText = `寫入中... 已處理 ${successCount} 筆`;
            }

            importStatus.innerText = `✅ 匯入成功！共更新 ${successCount} 筆資料。`;
            importStatus.className = "mt-4 text-green-600";
            excelFile.value = ""; 
            loadDashboardData(); // 重整儀表板

        } catch (error) {
            console.error(error);
            importStatus.innerText = "❌ 匯入失敗：格式錯誤或權限不足。";
            importStatus.className = "mt-4 text-red-600";
        } finally {
            importBtn.innerText = "開始匯入"; importBtn.disabled = false;
        }
    };
    reader.readAsArrayBuffer(file);
});

// === 4. 導師分班產出 (匯出 Excel) ===
document.getElementById('exportBtn').addEventListener('click', async () => {
    const btn = document.getElementById('exportBtn');
    const status = document.getElementById('exportStatus');
    btn.innerText = "資料整理中..."; btn.disabled = true;

    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        const dataArr = [];
        querySnapshot.forEach((doc) => {
            dataArr.push(doc.data());
        });

        if (dataArr.length === 0) throw new Error("無資料可匯出");

        // 使用 SheetJS 產生 Excel 並下載
        const worksheet = XLSX.utils.json_to_sheet(dataArr);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "新生名冊總表");
        
        const dateStr = new Date().toISOString().slice(0,10).replace(/-/g, "");
        XLSX.writeFile(workbook, `115學年度新生報到總表_${dateStr}.xlsx`);

        status.classList.remove('hidden');
        setTimeout(() => status.classList.add('hidden'), 5000);

    } catch (error) {
        console.error("匯出失敗:", error);
        alert("匯出失敗，可能目前沒有資料或連線異常。");
    } finally {
        btn.innerHTML = "⬇️ 下載完整新生名冊 Excel"; btn.disabled = false;
    }
});

// === 5. 年度重置功能 ===
const resetInput = document.getElementById('resetInput');
const resetBtn = document.getElementById('resetBtn');

resetInput.addEventListener('input', (e) => {
    if (e.target.value === '確認清空') {
        resetBtn.disabled = false; resetBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        resetBtn.disabled = true; resetBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
});

resetBtn.addEventListener('click', async () => {
    if (confirm("⚠️ 警告！這將永久刪除所有資料，確定執行？")) {
        resetBtn.innerText = "清空中..."; resetBtn.disabled = true;
        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            const promises = [];
            querySnapshot.forEach((document) => promises.push(deleteDoc(doc(db, "students", document.id))));
            await Promise.all(promises);
            
            alert("✅ 資料已清空！");
            resetInput.value = ''; resetBtn.innerText = "執行年度資料重置";
            loadDashboardData();
        } catch (error) {
            console.error("刪除失敗:", error); alert("權限不足或連線失敗。");
        }
    }
});
