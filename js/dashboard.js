// js/dashboard.js
import { db } from './firebase-config.js';
import { collection, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    // 最後一道防線警告
    const confirmDelete = confirm("⚠️ 警告！這將會永久刪除資料庫中所有的學生報到資料，確定要執行嗎？");
    
    if (confirmDelete) {
        resetBtn.innerText = "清空中...";
        resetBtn.disabled = true;

        try {
            const querySnapshot = await getDocs(collection(db, "students"));
            
            // 由於 Firestore 不能一次刪除整個集合，必須逐筆刪除
            const deletePromises = [];
            querySnapshot.forEach((document) => {
                deletePromises.push(deleteDoc(doc(db, "students", document.id)));
            });

            await Promise.all(deletePromises);
            
            alert("✅ 年度資料已成功清空！您可以開始匯入新學年度的名單了。");
            resetInput.value = '';
            resetBtn.innerText = "執行年度資料重置";
            
        } catch (error) {
            console.error("刪除失敗:", error);
            alert("發生錯誤，權限不足或連線失敗。");
            resetBtn.innerText = "執行年度資料重置";
        }
    }
});
