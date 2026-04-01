import { db } from './firebase-config.js';
import { collection, getDocs, doc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let allData = [];
let sortConfig = { key: '姓名', direction: 'asc' };

// --- 讀取資料 ---
async function loadData() {
    const qs = await getDocs(collection(db, "students"));
    allData = qs.docs.map(d => d.data());
    applySortAndRender();
}

// --- 排序邏輯 ---
window.toggleSort = (key) => {
    if (sortConfig.key === key) {
        sortConfig.direction = sortConfig.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortConfig.key = key;
        sortConfig.direction = 'asc';
    }
    applySortAndRender();
};

function applySortAndRender() {
    allData.sort((a, b) => {
        let valA = a[sortConfig.key] || "";
        let valB = b[sortConfig.key] || "";
        
        // 針對班級/座號做數字處理
        if (sortConfig.key === '班級' || sortConfig.key === '座號') {
            valA = parseInt(valA) || 0;
            valB = parseInt(valB) || 0;
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });
    renderUI();
}

// --- 渲染表格 (左右橫移的資料列) ---
function renderUI() {
    const tbody = document.getElementById('studentTableBody');
    let html = '';
    
    allData.forEach(s => {
        const st = s["報到狀態"] || "未報到";
        const statusClass = st === "線上報到" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500";
        
        html += `
            <tr class="student-row hover:bg-blue-50 transition border-b" data-id="${s["身份證號"]}">
                <td class="p-4"><span class="px-2 py-1 rounded-md text-xs font-bold ${statusClass}">${st}</span></td>
                <td class="p-4 font-bold text-blue-600">${s["班級"] || '--'}-${s["座號"] || '--'}</td>
                <td class="p-4 font-bold">${s["姓名"]}</td>
                <td class="p-4 font-mono text-slate-400">${s["身份證號"]}</td>
                <td class="p-4">${s["出生年月日"] || ''}</td>
                <td class="p-4">${s["監護人姓名"] || ''}</td>
                <td class="p-4">${s["聯絡電話"] || s["監護人手機"] || ''}</td>
                <td class="p-4 text-xs">${s["本土語言名稱"] || ''}</td>
                <td class="p-4 text-xs text-slate-500">${s["通訊地址"] || ''}</td>
                <td class="p-4 text-xs text-slate-500">${s["戶籍地址"] || ''}</td>
            </tr>`;
    });
    
    tbody.innerHTML = html;
    document.querySelectorAll('.student-row').forEach(r => {
        r.addEventListener('click', () => openEditModal(r.dataset.id));
    });
    updateSummary();
}

// --- 彈窗編輯 (全欄位) ---
function openEditModal(id) {
    const s = allData.find(x => x["身份證號"] === id);
    if (!s) return;

    document.getElementById('displayId').innerText = id;
    const container = document.getElementById('dynamicFields');
    container.innerHTML = '';

    // 自動生成所有欄位的 Input
    Object.keys(s).sort().forEach(key => {
        const fieldDiv = document.createElement('div');
        fieldDiv.className = "flex flex-col space-y-1 mb-2";
        
        let inputHtml = '';
        if (key === "報到狀態") {
            inputHtml = `
                <select class="dynamic-input border-2 border-slate-100 p-2 rounded-xl focus:border-blue-400" data-key="${key}">
                    <option value="未報到" ${s[key]==='未報到'?'selected':''}>未報到</option>
                    <option value="線上報到" ${s[key]==='線上報到'?'selected':''}>線上報到</option>
                    <option value="出國" ${s[key]==='出國'?'selected':''}>出國</option>
                    <option value="私校" ${s[key]==='私校'?'selected':''}>就讀私校</option>
                </select>`;
        } else {
            inputHtml = `<input type="text" class="dynamic-input border-2 border-slate-100 p-2 rounded-xl focus:border-blue-400" 
                        data-key="${key}" value="${s[key] || ''}">`;
        }

        fieldDiv.innerHTML = `<label class="text-[10px] font-bold text-slate-400 uppercase">${key}</label>${inputHtml}`;
        container.appendChild(fieldDiv);
    });

    document.getElementById('editModal').style.display = 'flex';
}

// 儲存、切換分頁等基礎功能 (略，同上一版)
document.getElementById('saveEditBtn').addEventListener('click', async () => {
    const id = document.getElementById('displayId').innerText;
    const updateData = {};
    document.querySelectorAll('.dynamic-input').forEach(i => updateData[i.dataset.key] = i.value);
    await updateDoc(doc(db, "students", id), updateData);
    document.getElementById('editModal').style.display = 'none';
    loadData();
});

document.querySelectorAll('.menu-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.menu-btn').forEach(b => b.classList.remove('sidebar-active'));
        btn.classList.add('sidebar-active');
        document.querySelectorAll('.panel-section').forEach(p => p.classList.add('hidden'));
        document.getElementById(btn.dataset.target).classList.remove('hidden');
    });
});

document.getElementById('closeModalBtn').onclick = () => document.getElementById('editModal').style.display='none';

loadData();
