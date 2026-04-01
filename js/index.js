// js/index.js
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let currentStudentDocId = null;
let currentStudentName = "";

// 登入驗證
document.getElementById('btnLogin').addEventListener('click', async () => {
    const loginId = document.getElementById('loginId').value.trim().toUpperCase();
    const loginBirthday = document.getElementById('loginBirthday').value.trim();
    const msgDiv = document.getElementById('loginMessage');
    msgDiv.classList.add('hidden');

    if (!loginId.match(/^[A-Z][12]\d{8}$/)) {
        showError("身份證號格式錯誤！請輸入首字大寫英文加9碼數字。");
        return;
    }
    if (loginBirthday.length < 6) {
        showError("生日格式錯誤！請輸入民國年，例如：1080101。");
        return;
    }

    try {
        document.getElementById('btnLogin').innerText = "驗證中...";
        // 注意：Excel 匯入的欄位名稱是 "身份證號" 和 "出生日期"
        const q = query(collection(db, "students"), where("身份證號", "==", loginId), where("出生日期", "==", loginBirthday));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showError("查無資料。可能學生您不是被認定為本校學生，請直接攜帶戶口名簿到本校進行紙本填寫報到。");
        } else {
            const docSnap = querySnapshot.docs[0];
            const studentData = docSnap.data();

            if (studentData["報到狀態"] === '已報到') {
                showError("您已完成報到。若需修改資料請電洽 3411373#112 聯絡註冊組修正。");
            } else {
                currentStudentDocId = docSnap.id;
                currentStudentName = studentData["姓名"];
                
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('formSection').classList.remove('hidden');
                
                // 帶入基礎資料
                document.getElementById('studentName').value = studentData["姓名"] || "";
                document.getElementById('studentId').value = studentData["學生編號"] || "";
                document.getElementById('studentRocId').value = studentData["身份證號"] || "";
                document.getElementById('studentDob').value = studentData["出生日期"] || "";
            }
        }
    } catch (error) {
        console.error(error);
        showError("系統連線錯誤，請稍後再試。");
    } finally {
        document.getElementById('btnLogin').innerText = "驗證並開始報到";
    }
});

function showError(text) {
    const msgDiv = document.getElementById('loginMessage');
    msgDiv.innerText = text;
    msgDiv.classList.remove('hidden');
}

// 表單送出 (自動抓取所有 name 屬性)
document.getElementById('enrollmentForm').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.innerText = "資料傳送中...";
    submitBtn.disabled = true;

    // 透過 FormData 自動收集所有欄位的值
    const formData = new FormData(e.target);
    const updateData = Object.fromEntries(formData.entries());
    
    // 加上系統時間與狀態
    const timeString = new Date().toLocaleString('zh-TW', { hour12: false });
    updateData["報到狀態"] = '已報到';
    updateData["報到時間"] = timeString;

    try {
        const studentRef = doc(db, "students", currentStudentDocId);
        await updateDoc(studentRef, updateData);

        document.getElementById('formSection').classList.add('hidden');
        document.getElementById('successSection').classList.remove('hidden');
        document.getElementById('successName').innerText = currentStudentName;
        document.getElementById('successTime').innerText = timeString;
        window.scrollTo(0, 0);

    } catch (error) {
        console.error("寫入錯誤:", error);
        alert("資料送出失敗，請重試或聯繫學校。");
        submitBtn.innerText = "確認送出報到資料";
        submitBtn.disabled = false;
    }
});
