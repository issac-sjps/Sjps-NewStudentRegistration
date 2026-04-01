<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>後台管理 - 新生報到系統</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"></script>
</head>
<body class="bg-gray-100 flex h-screen overflow-hidden text-gray-800">

    <aside class="w-64 bg-slate-800 text-white flex flex-col">
        <div class="p-4 border-b border-slate-700">
            <h2 class="text-xl font-bold">新莊註冊組後台</h2>
        </div>
        <nav class="flex-1 p-4 space-y-2" id="sidebarMenu">
            <button data-target="dashboardPanel" class="menu-btn w-full text-left p-2 rounded bg-blue-600 font-bold">📊 報到儀表板</button>
            <button data-target="importPanel" class="menu-btn w-full text-left p-2 rounded hover:bg-slate-700">📥 匯入基礎名冊</button>
            <button data-target="exportPanel" class="menu-btn w-full text-left p-2 rounded hover:bg-slate-700">📋 導師分班產出</button>
            <button data-target="settingsPanel" class="menu-btn w-full text-left p-2 rounded hover:bg-slate-700 text-red-400 mt-10">⚙️ 系統設定與重置</button>
        </nav>
    </aside>

    <main class="flex-1 overflow-y-auto p-8 relative">
        
        <section id="dashboardPanel" class="panel-section block">
            <h2 class="text-2xl font-bold mb-6 border-b pb-2">📊 報到儀表板</h2>
            <div class="grid grid-cols-3 gap-4 mb-6">
                <div class="bg-white p-4 rounded shadow border-l-4 border-blue-500"><p class="text-sm text-gray-500">總人數</p><p id="statTotal" class="text-2xl font-bold">0</p></div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-green-500"><p class="text-sm text-gray-500">已報到</p><p id="statDone" class="text-2xl font-bold text-green-600">0</p></div>
                <div class="bg-white p-4 rounded shadow border-l-4 border-red-500"><p class="text-sm text-gray-500">未報到</p><p id="statPending" class="text-2xl font-bold text-red-600">0</p></div>
            </div>
            <div class="bg-white rounded shadow overflow-hidden">
                <div class="p-4 bg-gray-50 border-b flex justify-between items-center">
                    <h3 class="font-bold">學生名單速覽</h3>
                    <button id="refreshTableBtn" class="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300">🔄 重新整理</button>
                </div>
                <table class="w-full text-left border-collapse">
                    <thead><tr class="bg-gray-100 text-sm"><th class="p-3 border-b">學生姓名</th><th class="p-3 border-b">身份證號</th><th class="p-3 border-b">狀態</th><th class="p-3 border-b">報到時間</th></tr></thead>
                    <tbody id="studentTableBody" class="text-sm"><tr><td colspan="4" class="p-4 text-center text-gray-500">載入中...</td></tr></tbody>
                </table>
            </div>
        </section>

        <section id="importPanel" class="panel-section hidden bg-white p-6 rounded-lg shadow-md max-w-3xl">
            <h2 class="text-2xl font-bold mb-6 border-b pb-2">📥 匯入基礎名冊 (Excel)</h2>
            <div class="mb-4">
                <p class="text-sm text-gray-600 mb-4">請上傳教育局提供的 Excel 檔。系統會以「身份證號」為基準，自動建立或更新名單。</p>
                <div class="flex items-center space-x-4">
                    <input type="file" id="excelFile" accept=".xlsx, .xls, .csv" class="border p-2 rounded w-full">
                    <button id="importBtn" class="bg-green-600 text-white px-6 py-2 rounded font-bold hover:bg-green-700 whitespace-nowrap">開始匯入</button>
                </div>
            </div>
            <div id="importStatus" class="mt-4 text-sm font-bold"></div>
        </section>

        <section id="exportPanel" class="panel-section hidden bg-white p-6 rounded-lg shadow-md max-w-3xl">
            <h2 class="text-2xl font-bold mb-6 border-b pb-2">📋 導師分班產出 (匯出總表)</h2>
            <p class="text-gray-600 mb-6">將目前資料庫中所有學生的完整資料（包含家長填寫的聯絡資訊與調查表）匯出成單一 Excel 檔案，供後續編班或校務系統建檔使用。</p>
            <button id="exportBtn" class="bg-blue-600 text-white px-8 py-4 rounded-lg font-bold text-xl hover:bg-blue-700 shadow flex items-center justify-center w-full md:w-auto">
                ⬇️ 下載完整新生名冊 Excel
            </button>
            <p id="exportStatus" class="mt-4 text-sm font-bold text-green-600 hidden">✅ 下載成功！</p>
        </section>

        <section id="settingsPanel" class="panel-section hidden bg-white p-6 rounded-lg shadow-md max-w-3xl">
            <h2 class="text-2xl font-bold mb-6 border-b pb-2">⚙️ 系統設定與年度維護</h2>
            <div class="mb-8 p-4 bg-red-50 border border-red-200 rounded">
                <h3 class="text-lg font-bold text-red-700 mb-2">⚠️ 年度資料重置 (危險操作)</h3>
                <p class="text-sm text-gray-600 mb-4">這將會清空 Firebase 資料庫中所有的學生紀錄。請輸入 <strong class="text-red-600">確認清空</strong> 來解鎖按鈕。</p>
                <div class="flex items-center space-x-4">
                    <input type="text" id="resetInput" placeholder="輸入確認指令" class="border p-2 rounded w-64 border-red-300">
                    <button id="resetBtn" class="bg-red-600 text-white px-4 py-2 rounded font-bold opacity-50 cursor-not-allowed" disabled>執行年度資料重置</button>
                </div>
            </div>
        </section>

    </main>
    <script type="module" src="js/dashboard.js"></script>
</body>
</html>
