async function loadData() {
    try {
        const qs = await getDocs(collection(db, "students"));
        allData = qs.docs.map(d => {
            const data = d.data();
            // --- 關鍵修正：自動標準化 ID 欄位 ---
            // 不管資料庫存的是 "身分證字號"、"身分證號" 還是 "身份證號"
            // 全部統一映射到一個系統變數 s_id
            data.s_id = data.身份證號 || data.身分證號 || data.身分證字號 || data.身份證字號 || d.id;
            return data;
        });

        if (allData.length === 0) {
            document.getElementById('mainTableBody').innerHTML = '<tr><td class="p-10 text-center">目前無資料</td></tr>';
            return;
        }

        // 動態抓取欄位
        const allKeys = new Set();
        allData.forEach(s => Object.keys(s).forEach(k => {
            if(k !== 's_id') allKeys.add(k); // 隱藏系統輔助 Key
        }));
        
        const priority = ["報到狀態", "班級", "座號", "姓名"];
        columns = priority.concat([...allKeys].filter(k => !priority.includes(k)));
        
        renderColumnToggles();
        renderAll();
    } catch (e) {
        console.error("讀取失敗:", e);
    }
}

// 修改表格渲染中的 ID 抓取
function renderMainTable() {
    // ... 前段表頭代碼不變 ...
    const body = document.getElementById('mainTableBody');
    body.innerHTML = allData.map(s => `
        <tr class="hover:bg-blue-50 border-b cursor-pointer" onclick="openEditModal('${s.s_id}')">
            ${columns.map(col => {
                const isHidden = hiddenColumns.has(col) ? 'column-hidden' : '';
                return `<td class="${isHidden} p-4 text-sm">${s[col] || ''}</td>`;
            }).join('')}
        </tr>`).join('');
}
