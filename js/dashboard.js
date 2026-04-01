// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// === 1. 年度重置功能 ===
const resetInput = document.getElementById('resetInput');
const resetBtn = document.getElementById('resetBtn');

// 監聽輸入框，只有輸入「確認清空」才能解鎖按鈕
resetInput.addEventListener('input', (e) => {
    if (e.target.value === '確認清空') {
        resetBtn.disabled = false;
        resetBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        resetBtn.classList.add('hover:bg-red-700');
    } else {
        resetBtn.disabled = true;
        resetBtn.classList.add('opacity-50', 'cursor-not-allowed');
        resetBtn.classList.remove('hover:bg-red-700');
    }
});

// 執行年度重置 (刪除所有學生資料)
resetBtn.addEventListener('click', async () => {
    const confirmDelete = confirm("⚠️ 警告！這將會永久刪除資料庫中所有的學生報到資料，確定要執行嗎？");
    
    if (confirmDelete) {
        resetBtn.innerText = "清空中...";
        resetBtn.disabled = true;

        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            const deletePromises = [];
            querySnapshot.forEach((document) => {
                deletePromises.push(deleteDoc(doc(db, "students", document.id)));
            });

            await Promise.all(deletePromises);
            
            alert("✅ 年度資料已成功清空！您可以開始匯入新學年度的名單了。");
            resetInput.value = '';
            resetBtn.innerText = "執行年度資料重置";
            resetBtn.disabled = true;
            resetBtn.classList.add('opacity-50', 'cursor-not-allowed');
            resetBtn.classList.remove('hover:bg-red-700');
            
        } catch (error) {
            console.error("刪除失敗:", error);
            alert("發生錯誤，權限不足或連線失敗。");
            resetBtn.innerText = "執行年度資料重置";
        }
    }
});

// === 2. Excel 匯入功能 ===
const excelFile = document.getElementById('excelFile');
const importBtn = document.getElementById('importBtn');
const importStatus = document.getElementById('importStatus');

importBtn.addEventListener('click', () => {
    const file = excelFile.files[0];
    if (!file) {
        alert("請先選擇 Excel 檔案！");
        return;
    }

    importBtn.innerText = "讀取中...";
    importBtn.disabled = true;
    importStatus.innerText = "正在解析 Excel 檔案...";
    importStatus.className = "mt-4 text-sm font-bold text-blue-600";

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

            if (jsonData.length === 0) {
                throw new Error("Excel 裡面沒有資料！");
            }

            importStatus.innerText = `解析成功，共 ${jsonData.length} 筆資料，準備寫入資料庫...`;

            let successCount = 0;
            let errorCount = 0;

            for (let i = 0; i < jsonData.length; i++) {
                const row = jsonData[i];
                
                // 容錯處理：抓取常見的欄位命名
                const rocId = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
                const dob = (row['出生日期'] || "").toString().trim();
                const name = (row['姓名'] || "").toString().trim();
                const status = (row['報到狀態'] || "未報到").toString().trim();
                const studentId = (row['學生編號'] || "").toString().trim();

                if (!rocId || !dob || !name) {
                    errorCount++;
                    continue; 
                }

                // 將身分證字號設為 Document ID
                const docRef = doc(db, "students", rocId);
                await setDoc(docRef, {
                    rocId: rocId,
                    dob: dob,
                    name: name,
                    status: status,
                    studentId: studentId,
                    lastUpdated: new Date().toLocaleString('zh-TW', { hour12: false })
                }, { merge: true });

                successCount++;
                
                if (successCount % 10 === 0) {
                    importStatus.innerText = `寫入中... 已處理 ${successCount} / ${jsonData.length} 筆`;
                }
            }

            importStatus.innerText = `✅ 匯入完成！成功：${successCount} 筆，失敗/略過缺漏：${errorCount} 筆。`;
            importStatus.className = "mt-4 text-sm font-bold text-green-600";
            excelFile.value = ""; 

        } catch (error) {
            console.error(error);
            importStatus.innerText = "❌ 匯入失敗：請確認 Excel 格式是否正確，或是否缺乏權限。";
            importStatus.className = "mt-4 text-sm font-bold text-red-600";
        } finally {
            importBtn.innerText = "開始匯入";
            importBtn.disabled = false;
        }
    };
    reader.readAsArrayBuffer(file);
});
