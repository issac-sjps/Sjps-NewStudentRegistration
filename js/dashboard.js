import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let pieChart;

// --- 讀取資料 ---
async function loadData() {
    const qs = await getDocs(collection(db, "students"));
    allData = qs.docs.map(d => d.data());
    renderUI();
}

// --- 渲染表格 ---
function renderUI() {
    const tbody = document.getElementById('studentTableBody');
    let html = '';
    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        html += `
            <tr class="student-row hover:bg-blue-50 transition" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded text-xs ${st==='線上報到'?'bg-green-100 text-green-700':'bg-gray-100'}">${st}</span></td>
                <td class="p-4 font-bold text-blue-600">${s["班級"] || '--'}-${s["座號"] || '--'}</td>
                <td class="p-4 font-bold text-slate-700">${s["姓名"]}</td>
                <td class="p-4 font-mono text-slate-400">${s["身份證號"]}</td>
                <td class="p-4 text-xs text-slate-500">${s["本土語言名稱"] || '--'}</td>
                <td class="p-4 text-blue-500 underline text-xs">詳細編修</td>
            </tr>`;
    });
    tbody.innerHTML = html;
    document.querySelectorAll('.student-row').forEach(r => r.addEventListener('click', () => openEditModal(r.dataset.id)));
}

// --- 【核心功能】動態彈窗 ---
function openEditModal(id) {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;

    document.getElementById('displayId').innerText = id;
    const container = document.getElementById('dynamicFields');
    container.innerHTML = ''; // 清空舊的

    // 定義哪些欄位不要顯示在編輯區 (例如重複的身分證號)
    const skipFields = ["報到時間"]; 

    // 自動遍歷該學生所有的 Key
    Object.keys(s).forEach(key => {
        if (skipFields.includes(key)) return;

        const fieldDiv = document.createElement('div');
        fieldDiv.className = "flex flex-col space-y-1";
        
        // 判斷是否為「狀態」欄位，使用下拉選單
        if (key === "報到狀態") {
            fieldDiv.innerHTML = `
                <label class="text-[10px] font-bold text-slate-400 uppercase">${key}</label>
                <select class="dynamic-input border-2 border-slate-100 p-2 rounded-xl outline-none focus:border-blue-400" data-key="${key}">
                    <option value="未報到" ${s[key]==='未報到'?'selected':''}>未報到</option>
                    <option value="線上報到" ${s[key]==='線上報到'?'selected':''}>線上報到</option>
                    <option value="出國" ${s[key]==='出國'?'selected':''}>出國</option>
                    <option value="私校" ${s[key]==='私校'?'selected':''}>就讀私校</option>
                </select>`;
        } else {
            // 一般欄位使用 Input
            fieldDiv.innerHTML = `
                <label class="text-[10px] font-bold text-slate-400 uppercase">${key}</label>
                <input type="text" class="dynamic-input border-2 border-slate-100 p-2 rounded-xl outline-none focus:border-blue-400" 
                    data-key="${key}" value="${s[key] || ''}">`;
        }
        container.appendChild(fieldDiv);
    });

    document.getElementById('editModal').style.display = 'flex';
}

// --- 儲存變更 ---
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('displayId').innerText;
    const inputs = document.querySelectorAll('.dynamic-input');
    const updateData = {};

    inputs.forEach(input => {
        updateData[input.dataset.key] = input.value;
    });

    try {
        await updateDoc(doc(db, "students", id), updateData);
        document.getElementById('editModal').style.display = 'none';
        alert("資料已更新");
        loadData();
    } catch (e) {
        alert("更新失敗：" + e.message);
    }
});

// --- 其他按鈕控制 (關閉彈窗等) ---
document.getElementById('closeModalBtn').addEventListener('click', () => {
    document.getElementById('editModal').style.display = 'none';
});

// 介面切換
document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

// 匯入功能 (略，同前版本)
document.getElementById('importBtn').addEventListener('click', async () => {
    const file = document.getElementById('excelFile').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
        for (let row of json) {
            const id = (row['身份證號'] || row['身分證號'] || "").toString().trim().toUpperCase();
            if (id) await setDoc(doc(db, "students", id), { ...row, "身份證號": id, "報到狀態": "未報到" }, { merge: true });
        }
        alert("匯入完成");
        loadData();
    };
    reader.readAsArrayBuffer(file);
});

loadData();
