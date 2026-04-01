// js/index.js
import { db } from './firebase-config.js';
import { collection, query, where, getDocs, updateDoc, doc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 全域變數，用來暫存登入成功的學生資料與文件 ID
let currentStudentDocId = null;
let currentStudentName = "";

// --- 1. 處理家長登入驗證 ---
document.getElementById('btnLogin').addEventListener('click', async () => {
    const loginId = document.getElementById('loginId').value.trim().toUpperCase();
    const loginBirthday = document.getElementById('loginBirthday').value.trim();
    const msgDiv = document.getElementById('loginMessage');
    msgDiv.classList.add('hidden');

    // 基本格式防呆
    if (!loginId.match(/^[A-Z][12]\d{8}$/)) {
        showError("身分證字號格式錯誤！請輸入首字大寫英文加9碼數字。");
        return;
    }
    if (loginBirthday.length < 6) {
        showError("生日格式錯誤！請輸入民國年，例如：1080101。");
        return;
    }

    try {
        document.getElementById('btnLogin').innerText = "驗證中...";
        // 到 Firestore 的 students 集合尋找符合的資料
        const q = query(collection(db, "students"), where("rocId", "==", loginId), where("dob", "==", loginBirthday));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            showError("查無資料。可能學生您不是被認定為本校學生，請直接攜帶戶口名簿到本校進行紙本填寫報到。");
        } else {
            const docSnap = querySnapshot.docs[0];
            const studentData = docSnap.data();

            if (studentData.status === '已報到') {
                showError("您已完成報到。若需修改資料請電洽 3411373#112 聯絡註冊組修正。");
            } else {
                // 驗證通過，切換畫面並帶入資料
                currentStudentDocId = docSnap.id;
                currentStudentName = studentData.name;
                
                document.getElementById('loginSection').classList.add('hidden');
                document.getElementById('formSection').classList.remove('hidden');
                
                document.getElementById('studentName').value = studentData.name;
                document.getElementById('studentId').value = studentData.studentId || "尚未編列";
                document.getElementById('studentRocId').value = studentData.rocId;
                document.getElementById('studentDob').value = studentData.dob;
            }
        }
    } catch (error) {
        console.error("讀取錯誤:", error);
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

// --- 2. 處理報到表單送出 ---
document.getElementById('enrollmentForm').addEventListener('submit', async (e) => {
    e.preventDefault(); // 阻止網頁重新整理

    // 取得當下時間
    const now = new Date();
    const timeString = now.toLocaleString('zh-TW', { hour12: false });

    // 準備要更新進資料庫的資料 (實務上這裡會抓取所有你設定的 input 值)
    const updateData = {
        status: '已報到',
        reportTime: timeString,
        // 範例：抓取表單內的值 (你需要為 HTML 的 input 加上 id 才能這樣抓)
        // address: document.getElementById('address').value,
        // fatherPhone: document.getElementById('fatherPhone').value
    };

    try {
        const studentRef = doc(db, "students", currentStudentDocId);
        await updateDoc(studentRef, updateData);

        // 成功後切換到截圖畫面
        document.getElementById('formSection').classList.add('hidden');
        document.getElementById('successSection').classList.remove('hidden');
        
        document.getElementById('successName').innerText = currentStudentName;
        document.getElementById('successTime').innerText = timeString;

    } catch (error) {
        console.error("寫入錯誤:", error);
        alert("資料送出失敗，請重試或聯繫學校。");
    }
});
